"""The coaching sidecar: a fast judge steers the voice model without slowing it.

The voice model has to answer within a second, so it cannot stop and think
about teaching. After each student turn, in the background, a decision
model reads the last few turns and answers a few yes/no questions: is the
student stuck, bored, repeating a mistake, would a card help now. It is
Jev on the Vercel AI Gateway's decision API, the same pattern as Dokki's
turn-decision layer: probabilities only, no generated text, a few hundred
milliseconds. A confident answer becomes a one-line note in the teacher's
instructions for the next turns.

Nothing waits on it. Slow, failing or switched off, the lesson simply goes
on as before.

    AI_GATEWAY_API_KEY  turns it on
    COACH=off           turns it off
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

import httpx

from reflect import Turn

logger = logging.getLogger("speakwow-agent.coach")

GATEWAY_URL = "https://ai-gateway.vercel.sh"
MODEL = "typesafe-ai/jev"
CONFIDENT = 0.7
RECENT_TURNS = 8
TIMEOUT_S = 2.5

QUESTIONS = {
    "stuck": {
        "type": "boolean",
        "instructions": "Judging the STUDENT's latest turns only: are they stuck, "
        "struggling to find words, or frustrated?",
    },
    "disengaged": {
        "type": "boolean",
        "instructions": "Are the student's recent answers short, flat or off-hand, "
        "as if they are bored or tired?",
    },
    "repeated_error": {
        "type": "boolean",
        "instructions": "Has the student made the same English mistake at least "
        "twice in these turns?",
    },
    "card": {
        "type": "choice",
        "instructions": "Would a card on the student's screen help right now? "
        "Choose the most useful one, or none.",
        "criteria": {
            "none": "Keep talking; no card is needed",
            "word_card": "They needed, asked about or misused a word",
            "choice": "A quick check of something just practised",
            "fill_blank": "Practise a form they keep getting wrong",
            "build_sentence": "They are struggling to put a sentence in order",
            "say_it": "A sentence worth saying aloud for pronunciation",
        },
    },
}

NOTES = {
    "stuck": "They seem stuck: slow down, say it more simply or start the sentence for them; they may say it in Chinese first.",
    "disengaged": "They seem bored or tired: switch to something they care about, light and short.",
    "repeated_error": "A mistake keeps coming back: point it out once, kindly, model it, let them retry.",
}


@dataclass(frozen=True)
class Advice:
    notes: tuple[str, ...]
    card: str | None

    def text(self) -> str | None:
        lines = list(self.notes)
        if self.card:
            lines.append(f"A {self.card} card would help now: consider show_widget.")
        return "\n".join(f"- {line}" for line in lines) or None


def build_state(
    turns: list[Turn], teacher: str, lesson_goal: str | None = None
) -> dict:
    recent = [t for t in turns if t.text.strip()][-RECENT_TURNS:]
    state: dict = {
        "conversation": [
            {
                "speaker": "student" if t.role == "user" else teacher,
                "text": t.text.strip()[:600],
            }
            for t in recent
        ]
    }
    if lesson_goal:
        state["lesson_goal"] = lesson_goal
    return state


def advice_from(answers: dict) -> Advice:
    notes = tuple(
        note
        for key, note in NOTES.items()
        if isinstance(answers.get(key), dict)
        and isinstance(answers[key].get("probability"), (int, float))
        and answers[key]["probability"] >= CONFIDENT
    )
    card = None
    choice = answers.get("card")
    if isinstance(choice, dict) and choice.get("choice") not in (None, "none"):
        probs = choice.get("probabilities") or {}
        if isinstance(probs, dict) and probs.get(choice["choice"], 0) >= CONFIDENT:
            card = choice["choice"]
    return Advice(notes, card)


class Coach:
    def __init__(self, api_key: str, client: httpx.AsyncClient | None = None) -> None:
        self.api_key = api_key
        self.client = client or httpx.AsyncClient(timeout=TIMEOUT_S)

    @classmethod
    def from_env(cls) -> Coach | None:
        if (os.getenv("COACH") or "").strip().lower() == "off":
            return None
        key = os.getenv("AI_GATEWAY_API_KEY")
        return cls(key.strip()) if key and key.strip() else None

    async def aclose(self) -> None:
        await self.client.aclose()

    async def advise(self, state: dict) -> Advice | None:
        try:
            res = await self.client.post(
                f"{GATEWAY_URL}/v1/evaluate",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"model": MODEL, "state": state, "questions": QUESTIONS},
            )
            res.raise_for_status()
            answers = res.json().get("answers")
        except Exception as error:  # never let the sidecar touch the lesson
            logger.info("coach skipped: %s", type(error).__name__)
            return None
        return advice_from(answers) if isinstance(answers, dict) else None
