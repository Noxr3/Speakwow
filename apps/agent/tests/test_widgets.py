import json
import re
from pathlib import Path

from widgets import KINDS, make_widget_tool, validate

WEB_WIDGETS = Path(__file__).resolve().parents[2] / "web" / "lib" / "widgets.ts"


def test_web_renders_exactly_the_kinds_the_agent_can_send() -> None:
    source = WEB_WIDGETS.read_text(encoding="utf-8")
    block = re.search(r"WIDGET_KINDS = \[(.*?)\]", source, re.DOTALL).group(1)
    assert set(re.findall(r"'([a-z_]+)'", block)) == set(KINDS)


def test_validation_explains_what_to_fix() -> None:
    assert validate({"kind": "iframe"})[1].startswith("kind must be")
    assert validate({"kind": "word_card"})[1] == "word_card needs 'word'"
    assert (
        "2 to 4" in validate({"kind": "choice", "question": "Q", "options": ["a"]})[1]
    )
    assert "___" in validate({"kind": "fill_blank", "sentence": "I go home."})[1]
    card, problem = validate(
        {"kind": "goals", "items": ["one", " ", "two"], "done": [0, True]}
    )
    assert problem is None and card["items"] == ["one", "two"] and card["done"] == [0]


async def test_tool_publishes_valid_cards_only() -> None:
    sent: list[str] = []

    async def publish(payload: str) -> None:
        sent.append(payload)

    tool = make_widget_tool(publish)
    ok = await tool(
        raw_arguments={"kind": "word_card", "word": "comfortable", "meaning": "舒服的"}
    )
    assert ok.startswith("Shown")
    card = json.loads(sent[0])
    assert (
        card["type"] == "widget"
        and card["word"] == "comfortable"
        and card["meaning"] == "舒服的"
    )
    assert (await tool(raw_arguments={"kind": "choice"})).startswith("Not shown")
    assert len(sent) == 1
