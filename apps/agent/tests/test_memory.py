import json

import httpx

from memory import SupabaseMemory, is_uuid
from reflect import Reflection, Turn

STUDENT = "11111111-1111-4111-8111-111111111111"
SESSION = "22222222-2222-4222-8222-222222222222"


def _memory(handler) -> tuple[SupabaseMemory, list[httpx.Request]]:
    calls: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return handler(request)

    client = httpx.AsyncClient(transport=httpx.MockTransport(record))
    return SupabaseMemory("http://db.local", "service-key", client), calls


def test_is_uuid() -> None:
    assert is_uuid(STUDENT)
    assert not is_uuid("user_123") and not is_uuid(None)


async def test_snapshot_and_session_start() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/rpc/get_student_snapshot"):
            return httpx.Response(
                200, json={"memories": [{"key": "name", "content": "Mei"}]}
            )
        return httpx.Response(201, json=[{"id": SESSION}])

    memory, calls = _memory(handler)
    assert (await memory.load_snapshot(STUDENT))["memories"][0]["content"] == "Mei"
    assert await memory.start_session(STUDENT, "frank", "room-1") == SESSION
    assert calls[0].headers["apikey"] == "service-key"
    assert json.loads(calls[0].content) == {"p_student": STUDENT}
    assert json.loads(calls[1].content)["persona_id"] == "frank"


async def test_finish_writes_transcript_summary_weaknesses_facts_and_level() -> None:
    memory, calls = _memory(lambda r: httpx.Response(201, json=[]))
    await memory.finish_session(
        student_id=STUDENT,
        session_id=SESSION,
        turns=[
            Turn("user", "I goed home"),
            Turn("assistant", "You went home!"),
            Turn("user", " "),
        ],
        reflection=Reflection(
            "Talked about home.",
            ["past tense"],
            [{"action": "create", "key": "family", "content": "has a sister"}],
            "A2",
        ),
        memory_snapshot=[],
    )
    by_path = {(c.method, c.url.path): json.loads(c.content) for c in calls}
    assert len(by_path[("POST", "/rest/v1/messages")]) == 2
    assert by_path[("PATCH", "/rest/v1/sessions")]["summary"] == "Talked about home."
    assert by_path[("POST", "/rest/v1/weaknesses")][0]["source"] == "live_session"
    writes = [
        json.loads(c.content)
        for c in calls
        if c.url.path.endswith("/rpc/apply_user_memory")
    ]
    assert writes[0]["p_content"] == "has a sister"
    assert "CEFR A2" in writes[1]["p_content"]
    assert not any(c.url.path.endswith(("/profiles", "/student_facts")) for c in calls)


async def test_a_known_level_is_never_overwritten_and_failures_do_not_raise() -> None:
    memory, calls = _memory(lambda r: httpx.Response(500))
    await memory.finish_session(
        student_id=STUDENT,
        session_id=SESSION,
        turns=[Turn("user", "hi")],
        reflection=Reflection("x", [], [], "C1"),
        memory_snapshot=[{"key": "english-level", "content": "CEFR B2"}],
    )
    assert not any(c.url.path == "/rest/v1/profiles" for c in calls)
    assert await memory.load_snapshot(STUDENT) is None
