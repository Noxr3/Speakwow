import json

import httpx

from lesson import current_unit, lesson_section, updated_progress
from memory import SupabaseMemory
from personas import load_personas
from reflect import Reflection, Turn, parse_reflection
from teacher import build_instructions, opening_instructions

GOALS = [
    {"id": "u1-g1", "kind": "speaking", "text": "introduce yourself"},
    {"id": "u1-g2", "kind": "grammar", "text": "use 'be' correctly"},
]
UNIT = {
    "id": "dddddddd-0000-4000-8000-000000000004",
    "position": 1,
    "title": "This is me!",
    "theme": "人与自我",
    "topic": "personal information",
    "goals": GOALS,
    "content": {"vocabulary": ["hobby", "classmate"], "grammar": ["be verbs"]},
    "goal_scores": {"u1-g1": 0.9},
    "mastery": 0.45,
    "sessions": 2,
}
SNAPSHOT = {
    "current_course": {
        "id": "cccccccc-0000-4000-8000-000000000003",
        "title": "7A",
        "current_unit": UNIT,
    }
}
FRANK = load_personas()["frank"]


def test_lesson_plan_lists_weakest_goal_first_and_course_mode_uses_it() -> None:
    plan = lesson_section(SNAPSHOT)
    assert plan.index("[u1-g2]") < plan.index("[u1-g1]")
    assert "hobby" in plan and "人与自我" in plan
    assert "## Today's lesson" in build_instructions(FRANK, SNAPSHOT, mode="course")
    assert "## Today's lesson" not in build_instructions(FRANK, SNAPSHOT, mode="free")
    # The lesson waits for the warm-up: the hello never mentions it.
    assert "lesson" not in opening_instructions(FRANK, SNAPSHOT).lower()
    assert "2. Topic" in build_instructions(FRANK, SNAPSHOT, mode="course")
    assert lesson_section({"current_course": None}) is None
    assert current_unit({}) is None


def test_progress_blends_scores_and_masters_when_every_goal_is_solid() -> None:
    row = updated_progress(UNIT, GOALS, {"u1-g2": 0.5})
    assert row["goal_scores"] == {"u1-g1": 0.9, "u1-g2": 0.5}
    assert row["status"] == "reviewing" and row["sessions"] == 3
    row = updated_progress({**UNIT, **row}, GOALS, {"u1-g2": 1.0})
    assert row["goal_scores"]["u1-g2"] == 0.8  # 0.5 * 0.4 + 1.0 * 0.6
    assert row["status"] == "mastered"
    assert updated_progress(None, GOALS, {})["status"] == "learning"


def test_reflection_keeps_only_known_goals_and_clamps_scores() -> None:
    raw = '{"summary": "ok", "goal_scores": {"u1-g1": 1.4, "u1-g2": -1, "made-up": 0.5, "x": true}}'
    r = parse_reflection(raw, {"u1-g1", "u1-g2"})
    assert r.goal_scores == {"u1-g1": 1.0, "u1-g2": 0.0}
    assert parse_reflection(raw).goal_scores == {}


async def test_a_mastered_unit_moves_the_student_to_the_next_one() -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.method == "GET" and request.url.path.endswith("/course_units"):
            return httpx.Response(200, json=[{"id": "next-unit"}])
        return httpx.Response(201, json=[])

    memory = SupabaseMemory(
        "http://db.local",
        "k",
        httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    unit = {**UNIT, "goal_scores": {"u1-g1": 0.9, "u1-g2": 0.9}}
    await memory.finish_session(
        student_id="aaaaaaaa-0000-4000-8000-000000000001",
        session_id="22222222-2222-4222-8222-222222222222",
        turns=[Turn("user", "I am Ada.")],
        reflection=Reflection("intro", goal_scores={"u1-g1": 1.0, "u1-g2": 0.9}),
        known_level="A2",
        lesson={"course_id": SNAPSHOT["current_course"]["id"], "unit": unit},
    )
    upsert = next(c for c in calls if c.url.path.endswith("/unit_progress"))
    assert upsert.headers["prefer"] == "resolution=merge-duplicates"
    assert json.loads(upsert.content)["status"] == "mastered"
    lookup = next(c for c in calls if c.method == "GET")
    assert "position=gt.1" in str(lookup.url)
    advance = next(c for c in calls if c.url.path.endswith("/enrollments"))
    assert json.loads(advance.content)["current_unit_id"] == "next-unit"
