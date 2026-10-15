import json

import httpx

from coach import CONFIDENT, Coach, advice_from, build_state
from reflect import Turn

TURNS = [
    Turn("assistant", "What did you do?"),
    Turn("user", "I... I goed... um"),
    Turn("user", " "),
]


def test_state_names_speakers_and_skips_blank_turns() -> None:
    state = build_state(TURNS, "Frank", "talk about the past")
    assert state["conversation"] == [
        {"speaker": "Frank", "text": "What did you do?"},
        {"speaker": "student", "text": "I... I goed... um"},
    ]
    assert state["lesson_goal"] == "talk about the past"


def test_only_confident_answers_become_notes() -> None:
    answers = {
        "stuck": {"type": "boolean", "probability": 0.91},
        "disengaged": {"type": "boolean", "probability": CONFIDENT - 0.01},
        "repeated_error": {"type": "boolean", "probability": "high"},
        "card": {
            "type": "choice",
            "choice": "fill_blank",
            "probabilities": {"fill_blank": 0.8},
        },
    }
    advice = advice_from(answers)
    assert len(advice.notes) == 1 and "stuck" in advice.notes[0]
    assert advice.card == "fill_blank"
    assert "show_widget" in advice.text()
    quiet = advice_from(
        {"card": {"type": "choice", "choice": "none", "probabilities": {"none": 0.9}}}
    )
    assert quiet.text() is None


async def test_calls_the_gateway_decision_api_and_survives_failure() -> None:
    seen = {}

    def ok(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200, json={"answers": {"stuck": {"type": "boolean", "probability": 0.95}}}
        )

    coach = Coach("gw", httpx.AsyncClient(transport=httpx.MockTransport(ok)))
    advice = await coach.advise(build_state(TURNS, "Frank"))
    assert seen["url"] == "https://ai-gateway.vercel.sh/v1/evaluate"
    assert seen["body"]["model"] == "typesafe-ai/jev"
    assert set(seen["body"]["questions"]) == {
        "stuck",
        "disengaged",
        "repeated_error",
        "card",
    }
    assert advice.notes

    down = Coach(
        "gw",
        httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(503))),
    )
    assert await down.advise({}) is None


def test_switch(monkeypatch) -> None:
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "gw")
    assert Coach.from_env() is not None
    monkeypatch.setenv("COACH", "off")
    assert Coach.from_env() is None
