import asyncio
import json
from types import SimpleNamespace

from agent import attach_cards
from widgets import CARD_DONE_NOTE, EVENT_TOPIC, CardLedger, validate


class FakeRoom:
    def __init__(self) -> None:
        self.handlers: dict[str, list] = {}

    def on(self, event, fn):
        self.handlers.setdefault(event, []).append(fn)

    def send(self, payload: dict, topic: str = EVENT_TOPIC) -> None:
        packet = SimpleNamespace(topic=topic, data=json.dumps(payload).encode())
        for fn in self.handlers.get("data_received", []):
            fn(packet)


def _setup():
    replies: list[dict] = []
    room = FakeRoom()
    ctx = SimpleNamespace(room=room, add_shutdown_callback=lambda fn: None)
    session = SimpleNamespace(
        current_speech=None,
        agent_state="listening",
        user_state="listening",
        generate_reply=lambda **kw: replies.append(kw),
    )
    teacher = SimpleNamespace(
        with_note=lambda note: f"WHOLE PROMPT\n## Right now\n{note}"
    )
    ledger = CardLedger()
    attach_cards(ctx, session, teacher, ledger)
    return room, ledger, replies


def _show(ledger: CardLedger) -> dict:
    card, _ = validate(
        {
            "kind": "choice",
            "question": "She ___ yesterday.",
            "options": ["go", "went", "goes"],
            "answer": "went",
        }
    )
    ledger.show(card)
    return card


async def test_a_tap_never_speaks_until_the_card_is_done() -> None:
    room, ledger, replies = _setup()
    card = _show(ledger)
    room.send(
        {"type": "card_event", "card_id": card["id"], "action": "answer", "given": "go"}
    )
    room.send({"type": "card_event", "card_id": card["id"], "action": "hint"})
    await asyncio.sleep(0.05)
    assert replies == []  # a first wrong try and a hint are the card's business
    room.send(
        {
            "type": "card_event",
            "card_id": card["id"],
            "action": "answer",
            "given": "went",
        }
    )
    await asyncio.sleep(0.05)
    assert len(replies) == 1
    line = replies[0]["user_input"]
    assert line.startswith("(card ") and "right on try 2, after the hint" in line
    assert (
        replies[0]["instructions"].startswith("WHOLE PROMPT")
        and CARD_DONE_NOTE in replies[0]["instructions"]
    )


async def test_old_cards_other_topics_and_junk_are_ignored() -> None:
    room, ledger, replies = _setup()
    old = _show(ledger)
    new = _show(ledger)
    room.send(
        {
            "type": "card_event",
            "card_id": old["id"],
            "action": "answer",
            "given": "went",
        }
    )
    room.send(
        {
            "type": "card_event",
            "card_id": new["id"],
            "action": "answer",
            "given": "went",
        },
        topic="lk.chat",
    )
    for fn in room.handlers["data_received"]:
        fn(SimpleNamespace(topic=EVENT_TOPIC, data=b"not json"))
    await asyncio.sleep(0.05)
    assert replies == []


async def test_a_finished_quiz_is_told_once() -> None:
    room, ledger, replies = _setup()
    card, _ = validate(
        {
            "kind": "quiz",
            "questions": [
                {"question": "1+1?", "options": ["2", "3"], "answer": "2"},
                {"question": "2+2?", "options": ["4", "5"], "answer": "4"},
            ],
        }
    )
    ledger.show(card)
    room.send(
        {
            "type": "card_event",
            "card_id": card["id"],
            "action": "done",
            "summary": "2 of 2 right",
        }
    )
    room.send(
        {
            "type": "card_event",
            "card_id": card["id"],
            "action": "done",
            "summary": "2 of 2 right",
        }
    )
    await asyncio.sleep(0.05)
    assert len(replies) == 1 and replies[0]["user_input"].endswith(": 2 of 2 right)")
