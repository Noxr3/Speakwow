import asyncio

from pacing import is_stand_in
from reactions import ReactionInbox, reaction_note, sticker_for
from stickers import load_stickers

STICKERS = load_stickers()


def test_a_line_that_is_only_a_sticker_is_a_reaction() -> None:
    assert sticker_for("😅", STICKERS)["id"] == "sweat_smile"
    assert sticker_for(" 😅😅 ", STICKERS)["id"] == "sweat_smile"
    assert sticker_for("haha 😅", STICKERS) is None
    assert sticker_for("", STICKERS) is None


def _inbox(busy=False, now=0.0):
    replies: list[tuple[str, str]] = []
    typed: list[str] = []
    clock = {"now": now}
    inbox = ReactionInbox(
        STICKERS,
        reply=lambda line, note: replies.append((line, note)),
        typed=typed.append,
        busy=lambda: busy,
        clock=lambda: clock["now"],
        window=0.02,
        gap=8.0,
    )
    return inbox, replies, typed, clock


async def test_three_quick_taps_are_one_short_answer() -> None:
    inbox, replies, typed, _ = _inbox()
    for _ in range(3):
        inbox.on_text("😅")
    await asyncio.sleep(0.05)
    assert len(replies) == 1 and typed == []
    line, note = replies[0]
    assert line == "(the student reacts with 😅)" and is_stand_in(line)
    assert "Never say emoji" in note and "hand them the turn" in note


async def test_typed_words_are_still_a_turn() -> None:
    inbox, replies, typed, _ = _inbox()
    inbox.on_text("I don't know")
    assert typed == ["I don't know"] and replies == []


async def test_a_tap_while_the_teacher_talks_does_not_interrupt() -> None:
    inbox, replies, typed, _ = _inbox(busy=True)
    inbox.on_text("😂")
    await asyncio.sleep(0.05)
    assert replies == [] and typed == []


async def test_at_most_one_answer_to_reactions_in_a_while() -> None:
    inbox, replies, _, clock = _inbox()
    inbox.on_text("😂")
    await asyncio.sleep(0.05)
    clock["now"] = 3.0
    inbox.on_text("🤔")
    await asyncio.sleep(0.05)
    assert len(replies) == 1
    clock["now"] = 12.0
    inbox.on_text("🤔")
    await asyncio.sleep(0.05)
    assert len(replies) == 2


def test_the_reaction_line_stays_out_of_memory_but_real_words_do_not() -> None:
    assert is_stand_in("(the student reacts with 😂)")
    assert not is_stand_in("(lol)")
    assert "😅" in reaction_note(sticker_for("😅", STICKERS))
