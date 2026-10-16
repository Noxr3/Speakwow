"""Does a teacher turn hand the conversation to the student?

Most learners will not start a turn on their own, so a turn that ends on a
statement, praise or a story leaves the call in a silence nobody owns
(research_notes/Easy to reply). These are the cheap checks from that note's
dead-end detector; the call log reports the share of teacher turns that hand
off, the number to watch (target: 95% or more for beginners).
"""

from __future__ import annotations

import re

_END_INVITES = re.compile(
    r"(your turn|you try|guess|tell me|and you|how about you|what about you|"
    r"yours\b|you\?|(\.\.\.|…|___)\s*$)",
    re.I,
)
_CLOSERS = re.compile(
    r"^(oh,?\s*)?((great|good|nice)( job| one| work)?|well done|cool|wow|"
    r"awesome|amazing|perfect|excellent|very good|okay|ok|me too|yes)[.!]*$",
    re.I,
)
_HANDS_TOPIC_BACK = re.compile(
    r"what do you want to (talk|say)|anything else|any questions|tell me something",
    re.I,
)
_TAG = re.compile(r"(right|yeah|or not|ok|okay)\?\s*$", re.I)
_SENTENCES = re.compile("(?<=[.!?\u3002\uff01\uff1f])\\s+")
_Q = "[?\uff1f]"  # a question mark, Western or full-width


def _last_sentence(turn: str) -> str:
    parts = [p for p in _SENTENCES.split(turn.strip()) if p.strip()]
    return parts[-1].strip() if parts else ""


def dead_ends(turn: str, max_words: int = 25) -> list[str]:
    """The research note's cheap patterns this turn shows (empty = fine):
    D1 ends on a statement, D2 ends on praise or a closer, D4 a question
    buried mid-turn, D5 two questions, D10 hands the topic back to them, D11
    too long before the hand-off."""
    text = turn.strip()
    if not text:
        return []
    found = []
    last = _last_sentence(text)
    ends_with_question = bool(re.search(_Q + r"\s*$", text))
    if not ends_with_question and not _END_INVITES.search(last):
        found.append("D2" if _CLOSERS.match(last) else "D1")
    if re.search(_Q, text):
        after = re.split(_Q, text)[-1]
        if len(after.split()) >= 3:
            found.append("D4")
        questions = len(re.findall(_Q, text))
        if questions >= 2 and not (questions == 2 and _TAG.search(text)):
            found.append("D5")
    if _HANDS_TOPIC_BACK.search(text):
        found.append("D10")
    if len(text.split()) > max_words + 8:  # the hand-off itself takes some words
        found.append("D11")
    return found


def hands_off(turn: str) -> bool:
    """Ends with a hand-off the student can pick up (D1/D2/D4 absent)."""
    return not {"D1", "D2", "D4"} & set(dead_ends(turn))


def handoff_rate(turns: list[str]) -> float | None:
    turns = [t for t in turns if t.strip()]
    return round(sum(hands_off(t) for t in turns) / len(turns), 2) if turns else None
