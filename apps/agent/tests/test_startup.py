import asyncio
from unittest.mock import AsyncMock

from startup import load_startup_snapshot


async def test_parallel_reads_reuse_matching_course_without_extra_database_calls():
    started = set()
    both_started = asyncio.Event()
    course = {
        "id": "c1",
        "current_unit": {
            "id": "u1",
            "title": "Hello",
            "content": {"sessions": [{"id": "learn"}]},
        },
    }
    original = {"current_course": course}

    async def read(name, value):
        started.add(name)
        if len(started) == 2:
            both_started.set()
        await asyncio.wait_for(both_started.wait(), 1)
        return value

    memory = AsyncMock()

    async def snapshot(_):
        return await read("snapshot", original)

    async def texts(_):
        return await read("texts", ["hello"])

    memory.load_snapshot.side_effect = snapshot
    memory.recent_texts.side_effect = texts
    result, available = await load_startup_snapshot(memory, "s1", "c1", "u1")
    assert available and result["current_course"] == course
    assert result["recent_texts"] == ["hello"]
    assert "recent_texts" not in original
    memory.load_study_course.assert_not_called()


async def test_different_signed_unit_uses_validated_course_lookup():
    memory = AsyncMock()
    memory.load_snapshot.return_value = {
        "current_course": {"id": "c1", "current_unit": {"id": "old"}}
    }
    memory.recent_texts.return_value = []
    memory.load_study_course.return_value = {"id": "c1", "current_unit": {"id": "u2"}}
    result, available = await load_startup_snapshot(memory, "s1", "c1", "u2")
    assert available and result["current_course"]["current_unit"]["id"] == "u2"
    memory.load_study_course.assert_awaited_once_with("s1", "c1", "u2")


async def test_unavailable_requested_course_never_falls_back_to_another_course():
    memory = AsyncMock()
    memory.load_snapshot.return_value = {"current_course": {"id": "other"}}
    memory.recent_texts.return_value = []
    memory.load_study_course.return_value = None
    _, available = await load_startup_snapshot(memory, "s1", "c1", "u2")
    assert not available


async def test_free_chat_can_start_without_memory():
    memory = AsyncMock()
    memory.load_snapshot.return_value = None
    memory.recent_texts.return_value = []
    assert await load_startup_snapshot(memory, "s1") == (None, True)
    memory.load_study_course.assert_not_called()


async def test_legacy_unit_keeps_database_session_normalization():
    memory = AsyncMock()
    memory.load_snapshot.return_value = {
        "current_course": {"id": "c1", "current_unit": {"id": "u1", "content": {}}}
    }
    memory.recent_texts.return_value = []
    memory.load_study_course.return_value = {
        "id": "c1",
        "current_unit": {"id": "u1", "content": {"sessions": [{"id": "learn"}]}},
    }
    result, available = await load_startup_snapshot(memory, "s1", "c1", "u1")
    assert available and result["current_course"]["current_unit"]["content"]["sessions"]
    memory.load_study_course.assert_awaited_once()
