"""Teaching cards: the teacher puts a small interactive card on screen.

Like a tutor sliding a flashcard across the table: a new word, a quick
check, a sentence to put in order, a short quiz. The web renders a fixed set
of typed components (apps/web/lib/widgets.ts), never model-written HTML, so
cards appear instantly and cannot run anything (the same choice ChatGPT,
ChatKit and A2UI made; research_notes/Interactive cards ChatGPT widgets).

How a card's answers flow (cards.py wires it to the call):
- Closed questions are graded on the student's phone for instant feedback,
  and again here with the same rules (grade()); the two must agree, and
  tests/test_widgets.py checks the shared cases.
- A tap is sent on its own data topic, never as a chat line, so it never
  interrupts the teacher. A first wrong try is the card's business: the
  student gets a second try and a hint. Only when the card is finished
  does the teacher hear one line about it (CardLedger.line) and react.
- An answer said out loud goes through the mark_card tool, graded here and
  mirrored onto the card.
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
import uuid
from collections.abc import Coroutine
from dataclasses import dataclass, field
from typing import Any, Callable

from livekit.agents import function_tool, get_job_context

# A finished card reaches the model as a line starting with CARD_LINE_START:
# a stand-in (pacing.is_stand_in), the card speaking rather than the student,
# so it stays out of turn counts and memory.
from pacing import CARD_LINE_START

logger = logging.getLogger("speakwow-agent.widgets")

WIDGET_TOPIC = "speakwow.widget"  # agent -> web: cards and voice marks
EVENT_TOPIC = "speakwow.widget.event"  # web -> agent: what the student did

Publisher = Callable[[str], Coroutine[Any, Any, None]]

# kind -> (required fields, optional fields); every kind may also carry
# title, hint and explain.
KINDS: dict[str, tuple[tuple[str, ...], tuple[str, ...]]] = {
    "word_card": (("word",), ("phonetic", "meaning", "example")),
    "choice": (("question", "options"), ("answer", "answers")),
    "true_false": (("statement", "answer"), ()),
    "fill_blank": (("sentence", "answer"), ("options", "accept")),
    "reorder": (("words", "answer"), ()),
    "match_pairs": (("pairs",), ()),
    "quiz": (("questions",), ()),
    "say_it": (("text",), ("tip",)),
    "goals": (("items",), ("done",)),
}
COMMON = ("title", "hint", "explain")
ALIASES = {"build_sentence": "reorder"}
GRADED = {"choice", "true_false", "fill_blank", "reorder", "match_pairs", "quiz"}
MAX_TEXT = 300
LETTERS = "ABCDEF"


WIDGET_GUIDE = """
## Cards on the student's screen
Use show_widget to put a card on the screen when SEEING or DOING it helps,
the way a tutor slides a flashcard across the table:
- word_card: a new word or phrase (word, phonetic, meaning in simple words or
  Chinese, example sentence)
- choice: a quick check (question, 2-6 options, answer = the right option's
  text; answers = several texts for "choose all that apply")
- true_false: a statement and whether it is true (answer "true" or "false")
- fill_blank: a sentence with ___ for one gap (answer, optional options to
  tap, accept = other answers that also count)
- reorder: words to put in order (words, answer = the right sentence)
- match_pairs: 2-5 pairs to match, each written "left = right"
- quiz: 2-5 choice questions in a row (questions: question, options, answer)
- say_it: a sentence for them to say out loud (text, tip)
- goals: today's goals as a checklist (items, done = numbers finished)
Add a hint for anything they answer, and explain = one line on why the
answer is right; the card shows them when they need them.
To practise, use a card they answer (choice, true_false, fill_blank,
reorder, match_pairs, quiz); word_card and say_it are for showing something
new. Cards are for practice: never while you are still getting to know them
or catching up. One card at a time, and only when it adds something: most turns
are just talk. Put the card up first, then point to it ("Have a look at this
one"), and never read it out. While a card is up, let them work: say little.
The card gives a second try and the hint by itself. When it is finished you
get a line starting with "(card": react once, like a tutor. Never contradict
the card's verdict. If they say an answer to the card out loud, call
mark_card with exactly what they said.
""".strip()


# ---------------------------------------------------------------- validation


def _text(value: object) -> str:
    return str(value).strip()[:MAX_TEXT]


def _texts(value: object, limit: int = 12) -> list[str] | None:
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        return None
    return [v.strip()[:MAX_TEXT] for v in value if v.strip()][:limit]


_EDGES = re.compile(
    "^[\"'\u201c\u201d]+|[\"'\u201c\u201d.!?,;:\u3002\uff01\uff1f\uff0c]+$"
)


def norm(text: str) -> str:
    """The comparison both graders use (apps/web/lib/widgets.ts normAnswer):
    case, width, curly quotes, spacing and end punctuation do not matter."""
    text = unicodedata.normalize("NFKC", text).lower()
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    text = re.sub(r"\s+", " ", text).strip()
    return _EDGES.sub("", text).strip()


def _option_index(options: list[str], answer: str) -> int | None:
    for i, option in enumerate(options):
        if norm(option) == norm(answer):
            return i
    return None


def _choice_item(raw: dict, label: str) -> tuple[dict | None, str | None]:
    question = _text(raw.get("question") or "")
    options = _texts(raw.get("options"), 6)
    if not question:
        return None, f"{label} needs 'question'"
    if options is None or not 2 <= len(options) <= 6:
        return None, f"{label} needs 2 to 6 options"
    if len({norm(o) for o in options}) != len(options):
        return None, f"{label}'s options must all be different"
    wanted = raw.get("answers") if raw.get("answers") else raw.get("answer")
    wanted = [wanted] if isinstance(wanted, str) else wanted
    if not isinstance(wanted, list) or not wanted:
        return None, (
            f"{label} needs 'answer': the exact text of the right option, "
            f'e.g. answer: "{options[0]}"'
        )
    indices = []
    for w in wanted:
        w = str(w).strip()
        i = _option_index(options, w)
        if i is None and len(w) == 1 and w.upper() in LETTERS[: len(options)]:
            i = LETTERS.index(w.upper())  # "B" for the second option
        if i is None:
            return None, f"{label}'s answer '{w}' is not one of its options"
        indices.append(i)
    return {
        "question": question,
        "options": options,
        "answer": sorted(set(indices)),
    }, None


def validate(args: dict[str, object]) -> tuple[dict | None, str | None]:
    """(card, None) when valid, else (None, a message the model can act on).
    Every graded card carries a checked answer key: a card that would mark a
    right answer wrong is worse than no card."""
    kind = ALIASES.get(str(args.get("kind")), args.get("kind"))
    questions = args.get("questions")
    if kind in ("choice", "fill_blank") and not (
        args.get("answer") or args.get("answers")
    ):
        # seen on grok: a quiz written as a choice or as a fill_blank (three
        # times in a row); one question with options is a choice
        if isinstance(questions, list) and len(questions) >= 2:
            kind = "quiz"
        elif (
            isinstance(questions, list)
            and len(questions) == 1
            and isinstance(questions[0], dict)
        ):
            kind = "choice"
            args = {**args, **questions[0]}
    if kind not in KINDS:
        return None, f"kind must be one of {sorted(KINDS)}"
    required, _optional = KINDS[kind]
    for f in required:
        if args.get(f) in (None, "", []):
            return None, f"{kind} needs '{f}'"
    card: dict[str, Any] = {"type": "widget", "id": uuid.uuid4().hex[:8], "kind": kind}
    for f in COMMON:
        if isinstance(args.get(f), str) and args[f].strip():
            card[f] = _text(args[f])

    if kind == "word_card":
        for f in ("word", "phonetic", "meaning", "example"):
            if args.get(f):
                card[f] = _text(args[f])
    elif kind == "say_it":
        card["text"] = _text(args["text"])
        if args.get("tip"):
            card["tip"] = _text(args["tip"])
    elif kind == "goals":
        items = _texts(args["items"])
        if not items:
            return None, "'items' must be a list of strings"
        card["items"] = items
        done = args.get("done") or []
        if not isinstance(done, list):
            return None, "'done' must be a list of item numbers"
        card["done"] = [
            d for d in done if isinstance(d, int) and not isinstance(d, bool)
        ]
    elif kind == "choice":
        item, problem = _choice_item(args, "choice")
        if problem:
            return None, problem
        card.update(item)
        card["multi"] = len(item["answer"]) > 1
    elif kind == "true_false":
        answer = norm(str(args["answer"]))
        if answer not in ("true", "false"):
            return None, "true_false's answer must be 'true' or 'false'"
        card["statement"] = _text(args["statement"])
        card["answer"] = answer == "true"
    elif kind == "fill_blank":
        sentence = _text(args["sentence"])
        if sentence.count("___") != 1:
            return None, "fill_blank's sentence needs exactly one ___ for the gap"
        card["sentence"] = sentence
        card["answer"] = _text(args["answer"])
        card["accept"] = _texts(args.get("accept") or []) or []
        if args.get("options"):
            options = _texts(args["options"], 6)
            if options is None or not 2 <= len(options) <= 6:
                return None, "fill_blank's options must be 2 to 6 strings"
            if _option_index(options, card["answer"]) is None:
                return None, "fill_blank's answer must be one of its options"
            card["options"] = options
            # Another option can never also count (seen on grok: "go" accepted
            # for "Yesterday I ___"), or tapping it would be marked right.
            wrong = {norm(o) for o in options} - {norm(card["answer"])}
            card["accept"] = [a for a in card["accept"] if norm(a) not in wrong]
    elif kind == "reorder":
        words = _texts(args["words"])
        if not words or len(words) < 3:
            return None, "reorder needs at least 3 words"
        answer = _text(args["answer"])
        if sorted(norm(w) for w in words) != sorted(norm(w) for w in answer.split()):
            return None, "reorder's answer must use exactly its words"
        card["words"], card["answer"] = words, answer
    elif kind == "match_pairs":
        raw = _texts(args["pairs"], 5)
        pairs = []
        for p in raw or []:
            left, sep, right = p.partition("=")
            if not sep or not left.strip() or not right.strip():
                return None, "each pair is written 'left = right'"
            pairs.append([left.strip(), right.strip()])
        if not 2 <= len(pairs) <= 5:
            return None, "match_pairs needs 2 to 5 pairs"
        card["pairs"] = pairs
    elif kind == "quiz":
        raw = args["questions"]
        if not isinstance(raw, list) or not 2 <= len(raw) <= 5:
            return None, "quiz needs 2 to 5 questions"
        questions = []
        for n, q in enumerate(raw, 1):
            if not isinstance(q, dict):
                return None, f"quiz question {n} must be an object"
            item, problem = _choice_item(q, f"quiz question {n}")
            if problem:
                return None, problem
            questions.append(item)
        card["questions"] = questions
    if kind in GRADED:
        card["max_attempts"] = max_attempts(card)
    return card, None


def max_attempts(card: dict) -> int:
    """A second try, except where a second try is a free answer."""
    if card["kind"] in ("true_false", "quiz", "match_pairs"):
        return 1
    if card["kind"] == "choice" and len(card["options"]) == 2 and not card["multi"]:
        return 1
    return 2


# ------------------------------------------------------------------- grading


def right_answer(card: dict) -> str:
    kind = card["kind"]
    if kind == "choice":
        return ", ".join(card["options"][i] for i in card["answer"])
    if kind == "true_false":
        return "true" if card["answer"] else "false"
    return str(card.get("answer", ""))


def _choices(card: dict, given: str) -> set[int] | None:
    """Which options a spoken or tapped answer names: their text, or a letter
    ("B", "option b", "b and d")."""
    options = card["options"]
    whole = _option_index(options, given)
    if whole is not None:
        return {whole}
    picked: set[int] = set()
    for part in re.split(r",|\band\b|和|、|\s+", norm(given)):
        part = part.removeprefix("option").strip()
        if not part:
            continue
        if len(part) == 1 and part.upper() in LETTERS[: len(options)]:
            picked.add(LETTERS.index(part.upper()))
        elif (i := _option_index(options, part)) is not None:
            picked.add(i)
        else:
            return None
    return picked or None


TRUE_WORDS = {"true", "yes", "right", "correct", "对", "是", "正确"}
FALSE_WORDS = {"false", "no", "wrong", "not true", "错", "不对", "错误"}


def grade(card: dict, given: str) -> bool | None:
    """True or False for a closed question; None when the answer cannot be
    read as one of the card's answers (ask again rather than mark wrong)."""
    kind = card["kind"]
    if kind == "choice":
        picked = _choices(card, given)
        return None if picked is None else picked == set(card["answer"])
    if kind == "true_false":
        said = norm(given)
        if said in TRUE_WORDS:
            return card["answer"] is True
        if said in FALSE_WORDS:
            return card["answer"] is False
        return None
    if kind == "fill_blank":
        accepted = {norm(card["answer"]), *(norm(a) for a in card.get("accept", []))}
        return norm(given) in accepted
    if kind == "reorder":
        return norm(given) == norm(card["answer"])
    return None


# -------------------------------------------------------------------- ledger


@dataclass
class CardState:
    card: dict
    tries: list[str] = field(default_factory=list)
    correct: bool = False
    revealed: bool = False
    hint_used: bool = False
    done: bool = False
    summary: str = ""


class CardLedger:
    """The cards shown in this call and what happened on each. The newest
    card is the only live one: an older card's events are ignored."""

    def __init__(self) -> None:
        self.cards: dict[str, CardState] = {}
        self.current: str | None = None

    def show(self, card: dict) -> None:
        self.cards[card["id"]] = CardState(card)
        self.current = card["id"]

    def live(self, card_id: str | None = None) -> CardState | None:
        state = self.cards.get(card_id or self.current or "")
        if state is None or state.card["id"] != self.current or state.done:
            return None
        return state

    def answer(self, card_id: str | None, given: str, via: str) -> dict | None:
        """Record one try. Returns what happened, or None when the card is
        not live or does not take answers (the event is dropped)."""
        state = self.live(card_id)
        if state is None or state.card["kind"] not in (
            "choice",
            "true_false",
            "fill_blank",
            "reorder",
        ):
            return None
        verdict = grade(state.card, given)
        if verdict is None:
            return {"card": state.card, "readable": False, "given": given}
        state.tries.append(given[:MAX_TEXT])
        state.correct = verdict
        final = verdict or len(state.tries) >= state.card["max_attempts"]
        if final:
            state.done, state.revealed = True, not verdict
        return {
            "card": state.card,
            "readable": True,
            "given": given,
            "correct": verdict,
            "attempt": len(state.tries),
            "final": final,
            "via": via,
        }

    def finish(self, card_id: str, summary: str) -> CardState | None:
        """A card the phone finished as a whole (a quiz, matching pairs) or
        a "show answer"; summary is the phone's account, kept short."""
        state = self.live(card_id)
        if state is None:
            return None
        state.done, state.summary = True, summary[:MAX_TEXT]
        if summary == "revealed":
            state.revealed, state.summary = True, ""
        return state

    def line(self, state: CardState) -> str:
        """The one line the teacher hears when a card is finished."""
        card = state.card
        prompt = card.get("question") or card.get("statement") or card.get("sentence")
        head = f"{CARD_LINE_START}{card['id']}, {card['kind']}"
        head += f': "{prompt}"' if prompt else ""
        if state.summary:
            return f"{head}: {state.summary})"
        tries = " then ".join(f'"{t}"' for t in state.tries) or "nothing"
        if state.correct:
            how = (
                "right first time"
                if len(state.tries) == 1
                else f"right on try {len(state.tries)}"
            )
        else:
            how = f'not right; the card now shows "{right_answer(card)}"'
        hint = ", after the hint" if state.hint_used else ""
        return f"{head}; they answered {tries}: {how}{hint})"


def is_card_line(text: str | None) -> bool:
    line = (text or "").strip()
    return line.startswith(CARD_LINE_START) and line.endswith(")")


CARD_DONE_NOTE = (
    "The student just finished the card on their screen; the line above says "
    "how it went. React once, like a tutor: if they got it, praise exactly "
    "what they got right; if the card had to show the answer, say the right "
    "one once in a short sentence and let them say it. Never contradict the "
    "card's verdict, never read the card out, and do not put another card up "
    "straight away. End with one hand-off, as always: have them say the right "
    "answer, or ask one easy question that uses what the card practised."
)


# --------------------------------------------------------------------- tools


async def _publish_to_room(payload: str) -> None:
    room = get_job_context().room
    await room.local_participant.publish_data(
        payload, reliable=True, topic=WIDGET_TOPIC
    )


def _schema() -> dict:
    text = {"type": "string"}
    text_list = {"type": "array", "items": {"type": "string"}}
    return {
        "name": "show_widget",
        "description": "Put an interactive teaching card on the student's screen. "
        "Fill only the fields its kind uses.",
        "parameters": {
            "type": "object",
            "properties": {
                "kind": {"type": "string", "enum": list(KINDS)},
                "title": text,
                "hint": text,
                "explain": text,
                "word": text,
                "phonetic": text,
                "meaning": text,
                "example": text,
                "question": text,
                "statement": text,
                "sentence": text,
                "text": text,
                "tip": text,
                "answer": text,
                "answers": text_list,
                "accept": text_list,
                "options": text_list,
                "words": text_list,
                "pairs": text_list,
                "items": text_list,
                "done": {"type": "array", "items": {"type": "integer"}},
                "questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "question": text,
                            "options": text_list,
                            "answer": text,
                        },
                        "required": ["question", "options", "answer"],
                    },
                },
            },
            "required": ["kind"],
        },
    }


def make_widget_tool(
    publish: Publisher | None = None, ledger: CardLedger | None = None
):
    send = publish or _publish_to_room
    failures = [0]

    @function_tool(raw_schema=_schema())
    async def show_widget(raw_arguments: dict[str, object]) -> str:
        card, problem = validate(raw_arguments)
        if card is None:
            failures[0] += 1
            if failures[0] >= 2:
                # seen on grok: five broken tries, then "the card's being stubborn"
                return (
                    "Not shown again. No more cards for now: carry on by voice, "
                    "and never mention a card to the student."
                )
            return (
                f"Not shown: {problem}. Fix it and try once more, or carry on "
                "without it; never mention the card to the student."
            )
        failures[0] = 0
        try:
            await send(json.dumps(card, ensure_ascii=False))
        except Exception:
            logger.exception("could not publish widget")
            return "The card could not be shown. Do not mention it; carry on by voice."
        if ledger is not None:
            ledger.show(card)
        return (
            f"Shown on the student's screen as card {card['id']}. Point to it; "
            "don't read it out. Wait while they work on it."
        )

    return show_widget


def make_mark_tool(ledger: CardLedger, publish: Publisher | None = None):
    """The student said an answer to the card out loud: grade it the same
    way as a tap and show it on the card."""
    send = publish or _publish_to_room

    @function_tool(
        raw_schema={
            "name": "mark_card",
            "description": "The student said an answer to the card on their screen "
            "out loud (a letter like 'B', or the answer itself): mark it on the card.",
            "parameters": {
                "type": "object",
                "properties": {
                    "answer": {
                        "type": "string",
                        "description": "Exactly what the student said as their answer",
                    }
                },
                "required": ["answer"],
            },
        }
    )
    async def mark_card(raw_arguments: dict[str, object]) -> str:
        given = str(raw_arguments.get("answer") or "").strip()
        outcome = ledger.answer(None, given, "voice") if given else None
        if outcome is None:
            return "There is no open card that takes a spoken answer. Carry on talking."
        if not outcome["readable"]:
            return (
                f'"{given}" is not one of the card\'s answers. Ask which one they '
                "mean; do not mark it."
            )
        card = outcome["card"]
        update = {
            "type": "card_update",
            "card_id": card["id"],
            "given": given,
            "correct": outcome["correct"],
            "attempt": outcome["attempt"],
            "final": outcome["final"],
        }
        try:
            await send(json.dumps(update, ensure_ascii=False))
        except Exception:
            logger.exception("could not publish card update")
        if outcome["correct"]:
            return (
                f'Marked right on their card ("{given}"). Praise exactly what they '
                "got right, then hand them the turn: one easy question that uses it."
            )
        if not outcome["final"]:
            return (
                f'Marked not quite ("{given}"); the card gives them one more try. '
                "Encourage them, don't give the answer, and end by inviting their "
                "second try."
            )
        return (
            f'Marked not right; the card now shows "{right_answer(card)}". Say it '
            "once in a short sentence and let them say it."
        )

    return mark_card
