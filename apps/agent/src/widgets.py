"""Teaching widgets: the teacher puts a small interactive card on screen.

Like a tutor sliding a flashcard across the table: a new word, a quick check,
a sentence to say aloud, today's goals. The web renders a fixed set of typed
components (apps/web/lib/widgets.ts), never model-written HTML, so cards
appear instantly and cannot run anything. The student's tap or typed answer
comes back as a chat message starting with "[widget".
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import Coroutine
from typing import Any, Callable

from livekit.agents import function_tool, get_job_context

logger = logging.getLogger("speakwow-agent.widgets")

WIDGET_TOPIC = "speakwow.widget"

Publisher = Callable[[str], Coroutine[Any, Any, None]]

# kind -> (required fields, optional fields)
KINDS: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "word_card": (("word",), ("phonetic", "meaning", "example", "title")),
    "choice": (("question", "options"), ("answer", "title")),
    "fill_blank": (("sentence",), ("options", "answer", "title")),
    "build_sentence": (("words",), ("answer", "title")),
    "say_it": (("text",), ("tip", "title")),
    "goals": (("items",), ("done", "title")),
}
LIST_FIELDS = {"options", "words", "items"}
MAX_TEXT = 300

WIDGET_GUIDE = """
## Cards on the student's screen
Use show_widget to put a card on the screen when SEEING it helps, the way a
tutor slides a flashcard across the table:
- word_card: a new word or phrase (word, phonetic, meaning in simple words or
  Chinese, example sentence)
- choice: a quick check with 2-4 options (question, options, answer)
- fill_blank: a sentence with ___ for the gap (sentence, answer, options optional)
- build_sentence: scrambled words to put in order (words, answer)
- say_it: a sentence for them to say out loud (text, tip)
- goals: today's goals as a checklist (items, done = indexes finished)
Cards are for practice: never while you are still getting to know them or
catching up. One card at a time, and only when it adds something: most turns
are just talk. Do not read the card aloud word for word; point to it ("Have a look at
this one"). The student's answer arrives as a message starting with
"[widget"; react to it by voice like a teacher: praise exactly what was
right, or recast and let them try again.
""".strip()


def validate(args: dict[str, object]) -> tuple[dict | None, str | None]:
    """(card, None) when valid, else (None, a message the model can act on)."""
    kind = args.get("kind")
    if kind not in KINDS:
        return None, f"kind must be one of {sorted(KINDS)}"
    required, optional = KINDS[kind]
    card: dict[str, object] = {
        "type": "widget",
        "id": uuid.uuid4().hex[:12],
        "kind": kind,
    }
    for field in (*required, *optional):
        value = args.get(field)
        if value in (None, "", []):
            if field in required:
                return None, f"{kind} needs '{field}'"
            continue
        if field in LIST_FIELDS:
            if not isinstance(value, list) or not all(
                isinstance(v, str) for v in value
            ):
                return None, f"'{field}' must be a list of strings"
            value = [v.strip()[:MAX_TEXT] for v in value if v.strip()][:12]
        elif field == "done":
            if not isinstance(value, list):
                return None, "'done' must be a list of item numbers"
            value = [v for v in value if isinstance(v, int) and not isinstance(v, bool)]
        else:
            value = str(value).strip()[:MAX_TEXT]
        card[field] = value
    if kind == "choice" and not 2 <= len(card["options"]) <= 4:
        return None, "choice needs 2 to 4 options"
    if kind == "fill_blank" and "___" not in card["sentence"]:
        return None, "fill_blank's sentence must contain ___ where the gap is"
    if kind == "build_sentence" and len(card["words"]) < 3:
        return None, "build_sentence needs at least 3 words"
    return card, None


async def _publish_to_room(payload: str) -> None:
    room = get_job_context().room
    await room.local_participant.publish_data(
        payload, reliable=True, topic=WIDGET_TOPIC
    )


def make_widget_tool(publish: Publisher | None = None):
    send = publish or _publish_to_room
    text = {"type": "string"}
    text_list = {"type": "array", "items": {"type": "string"}}

    @function_tool(
        raw_schema={
            "name": "show_widget",
            "description": "Put an interactive teaching card on the student's screen. "
            "Fill only the fields its kind uses.",
            "parameters": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": list(KINDS)},
                    "title": text,
                    "word": text,
                    "phonetic": text,
                    "meaning": text,
                    "example": text,
                    "question": text,
                    "sentence": text,
                    "text": text,
                    "tip": text,
                    "answer": text,
                    "options": text_list,
                    "words": text_list,
                    "items": text_list,
                    "done": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["kind"],
            },
        }
    )
    async def show_widget(raw_arguments: dict[str, object]) -> str:
        card, problem = validate(raw_arguments)
        if card is None:
            return f"Not shown: {problem}. Fix it and try again, or just keep talking."
        try:
            await send(json.dumps(card, ensure_ascii=False))
        except Exception:
            logger.exception("could not publish widget")
            return "The card could not be shown. Carry on by voice."
        return "Shown on the student's screen. Talk about it; wait for their answer."

    return show_widget
