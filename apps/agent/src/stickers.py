"""Stickers: the teacher reacts with an animated emoji while talking.

The vocabulary is packages/shared/stickers.json (vendored like the persona
cards). The tool publishes on the room's data channel; the web client draws
the sticker over the call. Students send stickers back as ordinary chat
messages, so the model simply reads the emoji.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Coroutine
from pathlib import Path
from typing import Any, Callable

from livekit.agents import function_tool, get_job_context

from personas import shared_dirs

logger = logging.getLogger("speakwow-agent.stickers")

STICKER_TOPIC = "speakwow.sticker"

Publisher = Callable[[str], Coroutine[Any, Any, None]]


def load_stickers(path: Path | None = None) -> list[dict]:
    candidates = [path] if path else [d / "stickers.json" for d in shared_dirs()]
    for candidate in candidates:
        if candidate.is_file():
            return json.loads(candidate.read_text(encoding="utf-8"))["stickers"]
    raise FileNotFoundError(f"stickers.json not found in {candidates}")


def sticker_guide(stickers: list[dict]) -> str:
    rows = "\n".join(f"- {s['id']} {s['emoji']}: {s['when']}" for s in stickers)
    return (
        "## Stickers\n"
        "You can send the student an animated sticker with the send_sticker tool "
        "while you keep talking, the way a friend drops an emoji in a chat. Use one "
        "at a real emotional moment (a laugh, a win, sympathy, surprise), about once "
        "every few turns, never twice in a row. Never say the sticker's name or "
        "announce that you are sending one. When the student sends you an emoji, "
        "react to it the way a friend would.\n"
        f"{rows}"
    )


async def _publish_to_room(payload: str) -> None:
    room = get_job_context().room
    await room.local_participant.publish_data(
        payload, reliable=True, topic=STICKER_TOPIC
    )


def make_sticker_tool(stickers: list[dict], publish: Publisher | None = None):
    by_id = {s["id"]: s for s in stickers}
    send = publish or _publish_to_room

    @function_tool(
        raw_schema={
            "name": "send_sticker",
            "description": "Show the student an animated sticker. Silent: keep talking normally.",
            "parameters": {
                "type": "object",
                "properties": {"sticker": {"type": "string", "enum": list(by_id)}},
                "required": ["sticker"],
            },
        }
    )
    async def send_sticker(raw_arguments: dict[str, object]) -> str:
        sticker = by_id.get(str(raw_arguments.get("sticker")))
        if sticker is None:
            return "Unknown sticker; nothing was sent."
        payload = json.dumps({"type": "sticker", "id": sticker["id"]})
        try:
            await send(payload)
        except Exception:
            logger.exception("could not publish sticker")
            return "The sticker could not be sent. Carry on."
        return "Sent. Continue the conversation; do not mention it."

    return send_sticker
