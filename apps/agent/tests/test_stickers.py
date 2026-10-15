import json

from stickers import load_stickers, make_sticker_tool, sticker_guide

STICKERS = load_stickers()


def test_guide_lists_every_sticker() -> None:
    guide = sticker_guide(STICKERS)
    for s in STICKERS:
        assert s["id"] in guide


async def test_tool_publishes_known_stickers_only() -> None:
    sent: list[str] = []

    async def publish(payload: str) -> None:
        sent.append(payload)

    tool = make_sticker_tool(STICKERS, publish)
    assert "Sent" in await tool(raw_arguments={"sticker": "clap"})
    assert json.loads(sent[0]) == {"type": "sticker", "id": "clap"}
    assert "Unknown" in await tool(raw_arguments={"sticker": "not-a-sticker"})
    assert len(sent) == 1
