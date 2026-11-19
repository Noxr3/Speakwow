"""Original teaching material on a shared, typed surface, never arbitrary HTML."""

from __future__ import annotations

import json
import uuid
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


def make_experiment_tool(publish=None, on_show=None):
    @function_tool
    async def show_experiment(
        a_total: int, a_success: int, b_total: int, b_success: int
    ) -> str:
        """Present two groups of trial counts for a conversion experiment. The private result
        verifies arithmetic. Let the learner interpret the counts before sharing feedback."""
        groups = [[a_total, a_success], [b_total, b_success]]
        if any(
            not 0 <= success <= total or not 1 <= total <= 1000000
            for total, success in groups
        ):
            return "Use positive totals up to one million and successes between zero and total."
        key = uuid.uuid4().hex
        payload = json.dumps(
            {
                "type": "material",
                "kind": "experiment",
                "title": "A/B",
                "groups": groups,
                "exercise": key,
            }
        )
        if publish:
            await publish(payload)
        else:
            await get_job_context().room.local_participant.publish_data(
                payload.encode(), topic="speakwow.material", reliable=True
            )
        a, b = [100 * success / total for total, success in groups]
        if on_show:
            on_show(key, b - a)
        return f"Private reference: A {a:.2f}%, B {b:.2f}%, B minus A {b - a:.2f} percentage points. Counts alone do not establish causality."

    return show_experiment
