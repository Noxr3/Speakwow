"""Entrypoint: one AgentServer, one dispatch name ("speakwow"), but routes to
Frank or Lucy based on the `agent` field in the job's dispatch metadata.
"""

import json
import logging

from dotenv import load_dotenv

# Load env vars BEFORE importing frank/lucy — those modules read os.getenv at
# import time. On Railway env vars come from the dashboard so this is a no-op;
# only matters for local dev where .env.local holds the keys.
load_dotenv(".env.local")

from livekit import rtc  # noqa: E402
from livekit.agents import (  # noqa: E402
    AgentServer,
    AgentSession,
    JobContext,
    cli,
    room_io,
)
from livekit.plugins import noise_cancellation, xai  # noqa: E402

from frank import Frank  # noqa: E402
from lucy import Lucy  # noqa: E402

logger = logging.getLogger("speakwow-agent")

# Startup env check — print directly so it shows up before logging is configured.
import os as _os  # noqa: E402
import sys as _sys  # noqa: E402

_REQUIRED = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "XAI_API_KEY"]
_missing = [k for k in _REQUIRED if not _os.getenv(k)]
_msg = (
    f"[agent.boot] ERROR missing required env vars: {_missing}"
    if _missing
    else f"[agent.boot] all required env vars present: {_REQUIRED}"
)
print(_msg, file=_sys.stderr, flush=True)
print(_msg, flush=True)
logger.warning(_msg)


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
