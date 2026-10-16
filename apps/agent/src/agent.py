"""Entrypoint: one AgentServer, one dispatch name ("speakwow").

The web app's token route writes the job metadata, signed into the
participant token: which teacher (`persona`, or the legacy `agent` display
name) and, for a signed-in student, `student_id`. With a student id and
Supabase configured, the teacher starts from what it remembers and writes
the lesson back to memory when the call ends.
"""

from __future__ import annotations

import asyncio
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
from coach import Coach, build_state, warming_up  # noqa: E402
from lesson import current_unit, unit_goals  # noqa: E402
from memory import SupabaseMemory, is_uuid  # noqa: E402
from pacing import (  # noqa: E402
    BREAK_AFTER_S,
    BREAK_NOTE,
    BREAK_TIME,
    QUIET,
    SilenceLadder,
    is_stand_in,
    student_share,
)
from personas import Persona, load_personas, resolve_persona  # noqa: E402
from providers import PROVIDERS, build_realtime_model, default_provider  # noqa: E402
from reflect import Reflector, Turn  # noqa: E402
from stickers import load_stickers, make_sticker_tool  # noqa: E402
from teacher import Teacher, has_learning_context, is_beginner  # noqa: E402
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
    return JobRequest(persona, student_id, user_key, mode)


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
    memory = SupabaseMemory.from_env() if student_id else None

    snapshot = session_id = None
    if memory and student_id:
        snapshot = await memory.load_snapshot(student_id)
    unit = current_unit(snapshot) if job.mode == "course" else None
    mode = "course" if unit else "free"
    if memory and student_id:
        session_id = await memory.start_session(
            student_id, persona.id, ctx.room.name, mode, unit["id"] if unit else None
        )
    logger.info(
        "starting session: persona=%s provider=%s byok=%s student=%s remembered=%s mode=%s",
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

    teacher = Teacher(
        persona,
        snapshot,
        STICKERS,
        tools=[make_sticker_tool(STICKERS), make_widget_tool()],
        mode=mode,
        provider=provider,
    )
    if coach := Coach.from_env():
        attach_coach(
            ctx, session, teacher, coach, unit, not has_learning_context(snapshot)
        )
    attach_pacing(ctx, session)

    await session.start(
        agent=teacher,
        room=ctx.room,
        room_options=room_io.RoomOptions(audio_input=_audio_options()),
    )


def attach_pacing(ctx: JobContext, session: AgentSession) -> None:
    """Patience when the student is quiet, a break after half an hour, and
    the student's share of the talking in the log (pacing.py)."""

    async def nudge(note: str) -> None:
        session.generate_reply(user_input=QUIET, instructions=note)

    ladder = SilenceLadder(nudge)
    session.on("agent_state_changed", lambda ev: ladder.on_agent_state(ev.new_state))
    session.on("user_state_changed", lambda ev: ladder.on_user_state(ev.new_state))

    async def suggest_break() -> None:
        await asyncio.sleep(BREAK_AFTER_S)
        session.generate_reply(user_input=BREAK_TIME, instructions=BREAK_NOTE)

    break_timer = asyncio.create_task(suggest_break())

    async def finish() -> None:
        ladder.close()
        break_timer.cancel()
        logger.info("call pace: student_share=%s", student_share(transcript(session)))

    ctx.add_shutdown_callback(finish)


def attach_coach(
    ctx: JobContext,
    session: AgentSession,
    teacher: Teacher,
    coach: Coach,
    unit: dict | None,
    first_meeting: bool,
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
        if advice is not None:
            await teacher.set_coaching_note(advice.text())

    @session.on("conversation_item_added")
    def _on_item(event) -> None:
        if (
            getattr(event.item, "role", None) != "user"
            or running
            or is_stand_in(getattr(event.item, "text_content", None))
        ):
            return
        task = asyncio.create_task(check())
        running.add(task)
        task.add_done_callback(running.discard)

    ctx.add_shutdown_callback(coach.aclose)


if __name__ == "__main__":
    cli.run_app(server)
