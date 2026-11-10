"""Original teaching material on a shared, typed surface, never arbitrary HTML."""

from __future__ import annotations

import json
from typing import Literal

from livekit.agents import function_tool, get_job_context

SCENES = ("park", "cafe", "market", "station")
Kind = Literal["picture", "reading", "writing", "dictation"]


def material(
    kind: str, title: str, text: str, prompt: str, scene: str | None
) -> dict | None:
    if kind not in ("picture", "reading", "writing", "dictation"):
        return None
    if kind == "picture" and scene not in SCENES:
        return None
    return {
        "type": "material",
        "kind": kind,
        "title": title[:100],
        "text": "" if kind == "dictation" else text[:2400],
        "prompt": prompt[:300],
        "scene": scene if kind == "picture" else None,
    }


def make_material_tool(publish=None):
    @function_tool
    async def show_material(
        kind: Kind, title: str, text: str = "", prompt: str = "", scene: str = ""
    ) -> str:
        """Show original teaching material. picture: choose park, cafe, market or station;
        reading: a short original passage in text; writing: prompt and optional draft;
        dictation: blank writing surface (never put the answer in title or prompt).
        Students submit writing as text. Never copy published passages.
        Scenes: park has a child with a red ball, dog, cyclist, bench and tree;
        cafe has a server, two customers, cups and a menu;
        market has a vendor, customer, apples and oranges;
        station has a traveller with a suitcase, clock and train.
        """
        data = material(kind, title, text, prompt, scene)
        if not data:
            return "Choose a supported material kind and picture scene."
        payload = json.dumps(data, ensure_ascii=False)
        if publish:
            await publish(payload)
        else:
            await get_job_context().room.local_participant.publish_data(
                payload.encode(), topic="speakwow.material", reliable=True
            )
        return "Material is on screen. Give them time; wait for their response."

    return show_material
