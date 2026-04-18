"""Entrypoint: one AgentServer, one dispatch name ("speakwow"), but routes to
Frank or Lucy based on the `agent` field in the job's dispatch metadata.
"""

import json
import logging

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import AgentSession, AgentServer, JobContext, cli, room_io
from livekit.plugins import noise_cancellation, xai

from frank import Frank
from lucy import Lucy

logger = logging.getLogger("speakwow-agent")

load_dotenv(".env.local")


server = AgentServer()


def _audio_options() -> room_io.AudioInputOptions:
    return room_io.AudioInputOptions(
        noise_cancellation=lambda params: noise_cancellation.BVCTelephony()
        if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
        else noise_cancellation.BVC(),
    )


# (Agent class, voice) per requested agent.
AGENTS = {
    "Frank": (Frank, "Rex"),
    "Lucy": (Lucy, "Ara"),
}


def _resolve_agent(ctx: JobContext) -> tuple[type, str]:
    """Pick the agent from dispatch metadata (falls back to Frank)."""
    raw = ctx.job.metadata or ""
    try:
        meta = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        meta = {}
    requested = meta.get("agent", "Frank")
    return AGENTS.get(requested, AGENTS["Frank"])


@server.rtc_session(agent_name="speakwow")
async def entrypoint(ctx: JobContext):
    agent_cls, voice = _resolve_agent(ctx)
    logger.info("starting session: agent=%s voice=%s", agent_cls.__name__, voice)

    session = AgentSession(
        llm=xai.realtime.RealtimeModel(voice=voice),
        min_interruption_duration=0.3,
    )
    await session.start(
        agent=agent_cls(),
        room=ctx.room,
        room_options=room_io.RoomOptions(audio_input=_audio_options()),
    )


if __name__ == "__main__":
    cli.run_app(server)
