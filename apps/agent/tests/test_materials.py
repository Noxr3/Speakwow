import json

from materials import make_material_tool, material


def test_dictation_never_displays_answer_and_scene_is_allowlisted():
    assert (
        material("dictation", "Listen", "secret answer", "Write what you hear.", None)[
            "text"
        ]
        == ""
    )
    assert material("picture", "Scene", "", "", "https://untrusted.test/a.svg") is None
    assert material("picture", "Scene", "", "", "park")["scene"] == "park"
    assert len(material("reading", "Read", "a" * 10000, "", None)["text"]) == 2400


async def test_material_tool_publishes_structured_content():
    out = []

    async def send(payload):
        out.append(json.loads(payload))

    tool = make_material_tool(publish=send)
    await tool(
        kind="writing",
        title="A note to a friend",
        text="",
        prompt="Invite your friend.",
        scene="",
    )
    assert out[0]["type"] == "material" and out[0]["kind"] == "writing"


async def test_experiment_card_checks_counts_and_computes_rates_privately():
    from materials import make_experiment_tool

    out = []

    async def send(payload):
        out.append(json.loads(payload))

    tool = make_experiment_tool(publish=send)
    await tool(a_total=0, a_success=3, b_total=100, b_success=20)
    assert not out
    result = await tool(a_total=100, a_success=10, b_total=200, b_success=30)
    assert out[0]["groups"] == [[100, 10], [200, 30]]
    assert "rates" not in out[0]
    assert "5.00 percentage points" in result
