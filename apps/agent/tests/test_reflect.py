import json

import httpx

from reflect import Reflector, Turn, format_transcript, parse_reflection

TURNS = [
    Turn("assistant", "Hey! What did you do this weekend?"),
    Turn("user", "I goed to the beach with my sister."),
    Turn("assistant", "Oh you went to the beach? Nice!"),
    Turn("user", "Yes, I have exam in December so I relax."),
]


def test_parse_tolerates_fences_and_filters_junk() -> None:
    raw = '```json\n{"summary": " Beach chat. ", "weaknesses": ["past tense", 3, ""], "facts": ["has a sister"], "level": "b1"}\n```'
    r = parse_reflection(raw)
    assert r.summary == "Beach chat."
    assert r.weaknesses == ["past tense"]
    assert r.facts == ["has a sister"]
    assert r.level == "B1"
    assert parse_reflection("no json here") is None
    assert parse_reflection('{"summary": ""}') is None
    assert parse_reflection('{"summary": "ok", "level": "expert"}').level is None


def test_transcript_labels_speakers() -> None:
    text = format_transcript(TURNS, "Frank")
    assert text.startswith("Frank: Hey!")
    assert "Student: I goed" in text


async def test_reflect_calls_an_openai_compatible_endpoint() -> None:
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        content = json.dumps(
            {
                "summary": "Beach.",
                "weaknesses": ["past tense"],
                "facts": [],
                "level": "A2",
            }
        )
        return httpx.Response(
            200, json={"choices": [{"message": {"content": content}}]}
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    reflector = Reflector(
        "k-123", base_url="http://llm.local/v1/", model="m", client=client
    )
    r = await reflector.reflect(TURNS, "Frank")
    assert r.summary == "Beach." and r.level == "A2"
    assert seen["url"] == "http://llm.local/v1/chat/completions"
    assert seen["auth"] == "Bearer k-123"
    assert "I goed to the beach" in seen["body"]["messages"][0]["content"]


async def test_reflect_skips_tiny_sessions_and_survives_errors() -> None:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda r: httpx.Response(500))
    )
    reflector = Reflector("k", client=client)
    assert await reflector.reflect(TURNS[:2], "Frank") is None
    assert await reflector.reflect(TURNS, "Frank") is None
