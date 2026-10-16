"""Entrypoint: one AgentServer, one dispatch name ("speakwow").

The web app's token route writes the job metadata, signed into the
participant token: which teacher (`persona`, or the legacy `agent` display
name) and, for a signed-in student, `student_id`. With a student id and
Supabase configured, the teacher starts from what it remembers and writes
the lesson back to memory when the call ends.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import sys
from dataclasses import dataclass

from dotenv import load_dotenv

# Load env vars before anything reads them. On Railway env vars come from the
# dashboard so this is a no-op; it matters for local dev (.env.local).
load_dotenv(".env.local")

from livekit import rtc  # noqa: E402
from livekit.agents import (  # noqa: E402
    AgentServer,
    AgentSession,
    JobContext,
    cli,
    room_io,
)
from livekit.plugins import noise_cancellation  # noqa: E402

from byok import UserKey, open_sealed, secret_from_env  # noqa: E402
from coach import Advice, Coach, build_state, warm_up_turns, warming_up  # noqa: E402
from lesson import current_unit, unit_goals  # noqa: E402
from life import news_today  # noqa: E402
from memory import SupabaseMemory, is_uuid  # noqa: E402
from pacing import (  # noqa: E402
    BREAK_AFTER_S,
    BREAK_NOTE,
    BREAK_TIME,
    QUIET,
    SILENCE_STEPS,
    SilenceLadder,
    is_stand_in,
    said_goodbye,
    student_share,
    warm_up_silence_steps,
)
from personas import Persona, load_personas, resolve_persona  # noqa: E402
from phone import normalize_phone  # noqa: E402
from providers import PROVIDERS, build_realtime_model, default_provider  # noqa: E402
from reactions import ReactionInbox  # noqa: E402
from reflect import Reflector, Turn  # noqa: E402
from stickers import load_stickers, make_sticker_tool  # noqa: E402
from teacher import (  # noqa: E402
    Teacher,
    has_learning_context,
    is_beginner,
    warm_up_note,
)
from widgets import make_widget_tool  # noqa: E402

logger = logging.getLogger("speakwow-agent")

_REQUIRED = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"]
_missing = [k for k in _REQUIRED if not os.getenv(k)]
_optional = {
    "provider": default_provider(),
    "operator_key": bool(os.getenv(f"{default_provider().upper()}_API_KEY")),
    "byok": bool(secret_from_env()),
    "memory": bool(SupabaseMemory.from_env()),
    "reflection": bool(Reflector.from_env()),
    "coach": bool(Coach.from_env()),
}
# print, so it shows before logging is configured (Railway boot logs).
print(
    f"[agent.boot] missing required env: {_missing}"
    if _missing
    else f"[agent.boot] required env present; optional: {_optional}",
    file=sys.stderr,
    flush=True,
)

PERSONAS = load_personas()
STICKERS = load_stickers()

server = AgentServer(
    # Keep a tiny idle pool — Railway containers are small and each worker
    # process loads heavy ML deps (silero/turn-detector) that eat memory.
    num_idle_processes=1,
    # Heavy imports can take >10s cold on a small box.
    initialize_process_timeout=60.0,
)


def _audio_options() -> room_io.AudioInputOptions:
    return room_io.AudioInputOptions(
        noise_cancellation=lambda params: noise_cancellation.BVCTelephony()
        if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
        else noise_cancellation.BVC(),
    )


@dataclass(frozen=True)
class JobRequest:
    persona: Persona
    student_id: str | None
    user_key: UserKey | None
    mode: str  # "free" | "course"
    # "phone": a call through LiveKit SIP. The phone number's dispatch rule
    # sets it in the job metadata; the caller is found by their number.
    channel: str = "web"
    persona_given: bool = False


def parse_job_metadata(raw: str | None) -> JobRequest:
    """Read what the token route signed into the job. Bad input degrades to a
    guest free-talk session with the default teacher, never a crash."""
    try:
        meta = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        meta = {}
    if not isinstance(meta, dict):
        meta = {}
    persona = resolve_persona(PERSONAS, meta.get("persona") or meta.get("agent"))
    student_id = meta.get("student_id") if is_uuid(meta.get("student_id")) else None
    user_key = None
    if sealed := meta.get("byok"):
        secret = secret_from_env()
        user_key = open_sealed(sealed, secret) if secret else None
        if user_key and user_key.provider not in PROVIDERS:
            user_key = None
    mode = "course" if meta.get("mode") == "course" and student_id else "free"
    channel = "phone" if meta.get("channel") == "phone" else "web"
    persona_given = bool(meta.get("persona") or meta.get("agent"))
    return JobRequest(persona, student_id, user_key, mode, channel, persona_given)


async def caller_number(ctx: JobContext) -> str | None:
    """The number calling in. LiveKit SIP puts it on the caller's participant;
    the student is whoever linked that number on the website."""
    await ctx.connect()
    try:
        participant = await asyncio.wait_for(
            ctx.wait_for_participant(kind=rtc.ParticipantKind.PARTICIPANT_KIND_SIP),
            timeout=15,
        )
    except TimeoutError:
        return None
    return normalize_phone(participant.attributes.get("sip.phoneNumber"))


def transcript(session: AgentSession) -> list[Turn]:
    turns: list[Turn] = []
    for item in session.history.items:
        role = getattr(item, "role", None)
        text = getattr(item, "text_content", None)
        if role in ("user", "assistant") and text and not is_stand_in(text):
            turns.append(Turn(role=role, text=text))
    return turns


@server.rtc_session(agent_name="speakwow")
async def entrypoint(ctx: JobContext) -> None:
    job = parse_job_metadata(ctx.job.metadata)
    persona, student_id, user_key = job.persona, job.student_id, job.user_key
    provider = user_key.provider if user_key else default_provider()
    caller = await caller_number(ctx) if job.channel == "phone" else None
    memory = SupabaseMemory.from_env() if (student_id or caller) else None
    if memory and caller and not student_id:
        link = await memory.student_for_phone(caller)
        student_id = link["student_id"] if link else None
    if memory and not student_id:
        # an unlinked number is a guest: no memory to read or write
        await memory.aclose()
        memory = None
    # nobody picks a teacher on the phone: the one they talked to last
    phone_pick = memory and student_id and job.channel == "phone"
    if (
        phone_pick
        and not job.persona_given
        and (last := await memory.last_persona(student_id))
    ):
        persona = resolve_persona(PERSONAS, last)

    snapshot = session_id = None
    if memory and student_id:
        snapshot = await memory.load_snapshot(student_id)
        if snapshot is not None and (texts := await memory.recent_texts(student_id)):
            snapshot["recent_texts"] = texts
    unit = current_unit(snapshot) if job.mode == "course" else None
    mode = "course" if unit else "free"
    if memory and student_id:
        session_id = await memory.start_session(
            student_id,
            persona.id,
            ctx.room.name,
            mode,
            unit["id"] if unit else None,
            channel=job.channel,
        )
    logger.info(
        "starting session: channel=%s persona=%s provider=%s byok=%s student=%s remembered=%s mode=%s",
        job.channel,
        persona.id,
        provider,
        bool(user_key),
        bool(student_id),
        bool(snapshot),
        mode,
    )

    session = AgentSession(
        llm=build_realtime_model(
            persona,
            provider,
            user_key.key if user_key else None,
            beginner=is_beginner(snapshot),
        ),
        min_interruption_duration=0.3,
    )

    if memory and student_id and session_id:
        profile = (snapshot or {}).get("profile") or {}
        known_level = profile.get("level")
        student_name = profile.get("display_name")
        lesson = (
            {"course_id": snapshot["current_course"]["id"], "unit": unit}
            if unit
            else None
        )

        async def remember_lesson() -> None:
            turns = transcript(session)
            reflector = Reflector.from_env()
            reflection = (
                await reflector.reflect(
                    turns, persona.display_name, unit_goals(unit), student=student_name
                )
                if reflector
                else None
            )
            await memory.finish_session(
                student_id=student_id,
                session_id=session_id,
                turns=turns,
                reflection=reflection,
                known_level=known_level,
                lesson=lesson,
            )
            await memory.aclose()
            logger.info(
                "lesson saved: turns=%d reflected=%s", len(turns), bool(reflection)
            )

        ctx.add_shutdown_callback(remember_lesson)

    first_meeting = not has_learning_context(snapshot)
    teacher = Teacher(
        persona,
        snapshot,
        STICKERS,
        # a phone has no screen: no stickers, no cards
        tools=[]
        if job.channel == "phone"
        else [make_sticker_tool(STICKERS), make_widget_tool()],
        mode=mode,
        provider=provider,
        channel=job.channel,
        warm_up_turns=warm_up_turns(first_meeting),
    )
    attach_phase(session, teacher, first_meeting)
    if coach := Coach.from_env():
        attach_coach(ctx, session, teacher, coach, unit, first_meeting, job.channel)
    attach_pacing(ctx, session, teacher, first_meeting)
    reactions = attach_reactions(ctx, session, teacher)

    await session.start(
        agent=teacher,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=_audio_options(),
            text_input=room_io.TextInputOptions(
                text_input_cb=lambda _session, ev: reactions.on_text(ev.text)
            ),
        ),
    )


def _report_failure(task: asyncio.Task) -> None:
    """Background work never touches the lesson, but its failures are
    logged with their cause (a swallowed TypeError hid the warm-up note on
    production, 2026-10-16)."""
    if not task.cancelled() and (error := task.exception()) is not None:
        logger.error("background task %s failed", task.get_name(), exc_info=error)


def _busy(session: AgentSession) -> bool:
    """On a realtime model the agent stays "listening" until its first audio
    frame, so a reply being prepared only shows as current_speech."""
    return (
        session.current_speech is not None
        or session.agent_state == "speaking"
        or session.user_state == "speaking"
    )


def attach_pacing(
    ctx: JobContext, session: AgentSession, teacher: Teacher, first_meeting: bool
) -> None:
    """Patience when the student is quiet, a break after half an hour, and
    the student's share of the talking in the log (pacing.py). While they are
    still getting to know each other, a quiet student gets the warm-up
    nudges, never a sentence starter."""

    async def nudge(note: str) -> None:
        if _busy(session):
            return  # a reply is already on its way
        session.generate_reply(user_input=QUIET, instructions=teacher.with_note(note))

    warm_up_steps = warm_up_silence_steps(news_today(teacher.persona), first_meeting)

    def steps() -> tuple[str, ...]:
        if warming_up(transcript(session), first_meeting):
            return warm_up_steps
        return SILENCE_STEPS

    ladder = SilenceLadder(nudge, steps=steps)
    session.on("agent_state_changed", lambda ev: ladder.on_agent_state(ev.new_state))
    session.on("user_state_changed", lambda ev: ladder.on_user_state(ev.new_state))

    @session.on("conversation_item_added")
    def _on_goodbye(event) -> None:
        # after a goodbye, silence is the end of the call, not a cue to nudge
        if said_goodbye(getattr(event.item, "text_content", None)):
            ladder.close()

    async def suggest_break() -> None:
        await asyncio.sleep(BREAK_AFTER_S)
        for _ in range(120):  # wait (up to a minute) for a quiet moment
            if not _busy(session):
                break
            await asyncio.sleep(0.5)
        ladder.close()  # the break closes the call; no nudges after it
        session.generate_reply(
            user_input=BREAK_TIME, instructions=teacher.with_note(BREAK_NOTE)
        )

    break_timer = asyncio.create_task(suggest_break(), name="break")
    break_timer.add_done_callback(_report_failure)

    async def finish() -> None:
        ladder.close()
        break_timer.cancel()
        logger.info("call pace: student_share=%s", student_share(transcript(session)))

    ctx.add_shutdown_callback(finish)


def attach_phase(session: AgentSession, teacher: Teacher, first_meeting: bool) -> None:
    """After each of the student's turns, tell the teacher how far the
    warm-up has come, so the getting-to-know part lasts its full count."""
    needed = warm_up_turns(first_meeting)
    pending: set[asyncio.Task] = set()

    @session.on("conversation_item_added")
    def _on_item(event) -> None:
        if getattr(event.item, "role", None) != "user" or is_stand_in(
            getattr(event.item, "text_content", None)
        ):
            return
        spoken = sum(1 for t in transcript(session) if t.role == "user")
        note = warm_up_note(spoken, needed, first_meeting)
        task = asyncio.create_task(teacher.set_phase_note(note), name="phase-note")
        pending.add(task)
        task.add_done_callback(pending.discard)
        task.add_done_callback(_report_failure)


def attach_reactions(
    ctx: JobContext, session: AgentSession, teacher: Teacher
) -> ReactionInbox:
    """A tapped sticker is a face, not a message: it never interrupts, and the
    teacher answers it in a few words only while waiting (reactions.py).
    Typed text is still a turn of its own."""

    def typed(text: str) -> None:
        session.interrupt()
        session.generate_reply(user_input=text)

    def reply(line: str, note: str) -> None:
        # the call may have ended while the taps were settling
        with contextlib.suppress(RuntimeError):
            session.generate_reply(
                user_input=line, instructions=teacher.with_note(note)
            )

    inbox = ReactionInbox(STICKERS, reply, typed, busy=lambda: _busy(session))

    async def finish() -> None:
        inbox.close()

    ctx.add_shutdown_callback(finish)
    return inbox


def attach_coach(
    ctx: JobContext,
    session: AgentSession,
    teacher: Teacher,
    coach: Coach,
    unit: dict | None,
    first_meeting: bool,
    channel: str = "web",
) -> None:
    """After each student turn, ask the sidecar in the background (coach.py).
    One check at a time; a turn that lands while one runs is skipped. While
    they are still getting to know each other, no cards or corrections."""
    goal = "; ".join(g.get("text", "") for g in unit_goals(unit)) if unit else None
    running: set[asyncio.Task] = set()

    async def check() -> None:
        turns = transcript(session)
        state = build_state(turns, teacher.persona.display_name, goal)
        advice = await coach.advise(state)
        if advice is not None and warming_up(turns, first_meeting):
            advice = advice.for_warm_up()
        if advice is not None and channel == "phone":
            advice = Advice(advice.notes, None)  # a phone has no screen for cards
        # A note describes this moment only: without fresh advice it goes,
        # rather than telling the teacher a happy student is still bored.
        await teacher.set_coaching_note(advice.text() if advice else None)

    @session.on("conversation_item_added")
    def _on_item(event) -> None:
        if (
            getattr(event.item, "role", None) != "user"
            or running
            or is_stand_in(getattr(event.item, "text_content", None))
        ):
            return
        task = asyncio.create_task(check(), name="coach")
        running.add(task)
        task.add_done_callback(running.discard)
        task.add_done_callback(_report_failure)

    ctx.add_shutdown_callback(coach.aclose)


if __name__ == "__main__":
    cli.run_app(server)
