import json
import re
from pathlib import Path

from pacing import is_stand_in
from widgets import (
    KINDS,
    CardLedger,
    grade,
    make_mark_tool,
    make_widget_tool,
    norm,
    validate,
)

WEB_WIDGETS = Path(__file__).resolve().parents[2] / "web" / "lib" / "widgets.ts"
CASES = json.loads((Path(__file__).parent / "card_cases.json").read_text("utf-8"))


def test_web_renders_exactly_the_kinds_the_agent_can_send() -> None:
    source = WEB_WIDGETS.read_text(encoding="utf-8")
    block = re.search(r"WIDGET_KINDS = \[(.*?)\]", source, re.DOTALL).group(1)
    assert set(re.findall(r"'([a-z_]+)'", block)) == set(KINDS)


def test_both_graders_agree_on_the_shared_cases() -> None:
    for name, given, expected in CASES["cases"]:
        assert grade(CASES["cards"][name], given) is expected, (name, given)


def test_a_spoken_letter_or_answer_counts_like_a_tap() -> None:
    past = CASES["cards"]["past"]
    assert grade(past, "B") is True and grade(past, "option b") is True
    assert grade(past, "A") is False
    assert grade(CASES["cards"]["fruit"], "a and c") is True
    assert (
        grade(CASES["cards"]["sky"], "no") is True
        and grade(CASES["cards"]["sky"], "对") is False
    )
    assert norm("\u201cWent\uff01\u201d") == "went"


def test_validation_explains_what_to_fix() -> None:
    assert validate({"kind": "iframe"})[1].startswith("kind must be")
    assert validate({"kind": "word_card"})[1] == "word_card needs 'word'"
    assert (
        "2 to 6"
        in validate(
            {"kind": "choice", "question": "Q", "options": ["a"], "answer": "a"}
        )[1]
    )
    assert (
        "not one of its options"
        in validate(
            {"kind": "choice", "question": "Q", "options": ["a", "b"], "answer": "c"}
        )[1]
    )
    assert (
        "exactly one ___"
        in validate({"kind": "fill_blank", "sentence": "I go.", "answer": "x"})[1]
    )
    assert (
        "exactly its words"
        in validate({"kind": "reorder", "words": ["a", "b", "c"], "answer": "a b d"})[1]
    )
    assert (
        "left = right" in validate({"kind": "match_pairs", "pairs": ["a", "b = c"]})[1]
    )
    card, problem = validate(
        {"kind": "goals", "items": ["one", " ", "two"], "done": [0, True]}
    )
    assert problem is None and card["items"] == ["one", "two"] and card["done"] == [0]


def test_cards_carry_a_checked_answer_key() -> None:
    choice, _ = validate(
        {
            "kind": "choice",
            "question": "Which are fruit?",
            "options": ["apple", "chair", "banana"],
            "answers": ["Apple", "banana"],
            "hint": "You can eat them.",
        }
    )
    assert (
        choice["answer"] == [0, 2] and choice["multi"] and choice["max_attempts"] == 2
    )
    two, _ = validate(
        {"kind": "choice", "question": "Q", "options": ["yes", "no"], "answer": "no"}
    )
    assert two["max_attempts"] == 1  # a second try would be a free answer
    old, problem = validate(
        {"kind": "build_sentence", "words": ["I", "am", "here"], "answer": "I am here"}
    )
    assert problem is None and old["kind"] == "reorder"
    quiz, problem = validate(
        {
            "kind": "quiz",
            "questions": [
                {"question": "1+1?", "options": ["2", "3"], "answer": "2"},
                {"question": "2+2?", "options": ["4", "5"], "answer": "4"},
            ],
        }
    )
    assert problem is None and [q["answer"] for q in quiz["questions"]] == [[0], [0]]
    pairs, _ = validate({"kind": "match_pairs", "pairs": ["apple = 苹果", "cat = 猫"]})
    assert pairs["pairs"] == [["apple", "苹果"], ["cat", "猫"]]


def _past_card(ledger: CardLedger) -> dict:
    card, _ = validate(
        {
            "kind": "choice",
            "question": "She ___ to school yesterday.",
            "options": ["go", "went", "goes"],
            "answer": "went",
        }
    )
    ledger.show(card)
    return card


def test_a_first_wrong_try_is_the_cards_business() -> None:
    ledger = CardLedger()
    card = _past_card(ledger)
    first = ledger.answer(card["id"], "go", "tap")
    assert first["final"] is False and first["correct"] is False
    second = ledger.answer(card["id"], "goes", "tap")
    assert second["final"] is True
    line = ledger.line(ledger.cards[card["id"]])
    assert line.startswith("(card ") and is_stand_in(line)
    assert '"go" then "goes"' in line and 'shows "went"' in line
    assert (
        ledger.answer(card["id"], "went", "tap") is None
    )  # finished cards take no more


def test_only_the_newest_card_is_live() -> None:
    ledger = CardLedger()
    old = _past_card(ledger)
    new = _past_card(ledger)
    assert ledger.answer(old["id"], "went", "tap") is None
    right = ledger.answer(new["id"], "went", "tap")
    assert right["final"] and right["correct"]
    assert "right first time" in ledger.line(ledger.cards[new["id"]])


async def test_show_and_mark_by_voice() -> None:
    sent: list[dict] = []

    async def publish(payload: str) -> None:
        sent.append(json.loads(payload))

    ledger = CardLedger()
    show = make_widget_tool(publish, ledger)
    mark = make_mark_tool(ledger, publish)
    assert (await mark(raw_arguments={"answer": "B"})).startswith(
        "There is no open card"
    )
    shown = await show(
        raw_arguments={
            "kind": "choice",
            "question": "She ___ yesterday.",
            "options": ["go", "went"],
            "answer": "went",
        }
    )
    assert "Shown" in shown and sent[0]["type"] == "widget"
    assert "Ask which one" in await mark(raw_arguments={"answer": "banana"})
    reply = await mark(raw_arguments={"answer": "B"})
    assert reply.startswith("Marked right") and sent[-1]["type"] == "card_update"
    assert sent[-1]["correct"] is True and sent[-1]["final"] is True
    assert (await show(raw_arguments={"kind": "choice"})).startswith("Not shown")


def test_common_slips_are_read_the_way_they_were_meant() -> None:
    letter, problem = validate(
        {"kind": "choice", "question": "Q", "options": ["go", "went"], "answer": "B"}
    )
    assert problem is None and letter["answer"] == [1]
    as_quiz, problem = validate(
        {
            "kind": "choice",
            "questions": [
                {"question": "1+1?", "options": ["2", "3"], "answer": "2"},
                {"question": "2+2?", "options": ["4", "5"], "answer": "4"},
            ],
        }
    )
    assert problem is None and as_quiz["kind"] == "quiz"
    one, problem = validate(
        {
            "kind": "choice",
            "questions": [{"question": "1+1?", "options": ["2", "3"], "answer": "2"}],
        }
    )
    assert problem is None and one["kind"] == "choice" and one["answer"] == [0]
    # seen on grok, three times in a row: a quiz written as a fill_blank
    blank_one, problem = validate(
        {
            "kind": "fill_blank",
            "title": "Irregular past tense",
            "sentence": "Yesterday I ___ to the shop.",
            "options": ["goed", "went", "go"],
            "questions": [
                {
                    "question": "Yesterday I ___ to the shop.",
                    "options": ["goed", "went", "go"],
                    "answer": "went",
                }
            ],
        }
    )
    assert problem is None and blank_one["kind"] == "choice"
    assert blank_one["answer"] == [1]
    blank_quiz, problem = validate(
        {
            "kind": "fill_blank",
            "questions": [
                {
                    "question": "I ___ home.",
                    "options": ["went", "goed"],
                    "answer": "went",
                },
                {
                    "question": "She ___ it.",
                    "options": ["saw", "seed"],
                    "answer": "saw",
                },
            ],
        }
    )
    assert problem is None and blank_quiz["kind"] == "quiz"
    assert (
        'e.g. answer: "goed"'
        in validate({"kind": "choice", "question": "Q", "options": ["goed", "went"]})[1]
    )


async def test_after_two_broken_cards_the_teacher_stops_trying() -> None:
    async def publish(payload: str) -> None:
        pass

    tool = make_widget_tool(publish, CardLedger())
    broken = {"kind": "choice", "question": "Q", "options": ["a", "b"]}
    first = await tool(raw_arguments=broken)
    assert first.startswith("Not shown:") and "never mention" in first
    assert "No more cards for now" in await tool(raw_arguments=broken)


def test_a_wrong_option_can_never_also_count() -> None:
    card, problem = validate(
        {
            "kind": "fill_blank",
            "sentence": "Yesterday I ___ home.",
            "options": ["went", "go", "goed"],
            "answer": "went",
            "accept": ["go", "went home"],
        }
    )
    assert problem is None and card["accept"] == ["went home"]
    assert grade(card, "go") is False
