from copy import deepcopy

import pytest

from curriculum import StudyFlow, active_session, session_goals, sessions_for
from reflect import Turn

UNIT = {
    "id": "unit-1",
    "position": 1,
    "title": "At the cafe",
    "goals": [{"id": "u1-g1", "text": "Order a drink", "kind": "speaking"}],
    "content": {
        "sessions": [
            {
                "id": "learn",
                "title": "Order together",
                "kind": "lesson",
                "activity": "scenario",
                "goal_ids": ["u1-g1"],
            },
            {
                "id": "check",
                "title": "Your turn",
                "kind": "exam",
                "activity": "scenario",
                "goal_ids": ["u1-g1"],
            },
        ]
    },
}


def test_sessions_resume_first_unfinished_and_exam_does_not_inherit_practice():
    unit = deepcopy(UNIT)
    unit["session_progress"] = {"learn": {"status": "mastered"}}
    unit["goal_scores"] = {"u1-g1": 1.0}
    assert active_session(unit)["id"] == "check"
    assert session_goals(unit) == UNIT["goals"]
    unit["session_progress"]["check"] = {"status": "mastered"}
    assert active_session(unit) is None


def test_existing_courses_get_a_plan_without_renaming_unit_or_goal_ids():
    unit = {**UNIT, "content": {}}
    assert [s["id"] for s in sessions_for(unit)] == ["learn", "practice", "check"]
    assert active_session(unit)["goal_ids"] == ["u1-g1"]
    assert active_session({**unit, "status": "mastered"}) is None


async def test_pause_chat_and_resume_preserve_lesson_and_only_capture_teaching():
    flow = StudyFlow(UNIT)
    assert flow.phase == "welcome"
    await flow.change("start")
    flow.observe(Turn("user", "I would like tea."))
    await flow.change("pause")
    assert flow.quiet
    flow.observe(Turn("user", "My cat is sleepy."))
    await flow.change("chat")
    for _ in range(3):
        flow.observe(Turn("user", "Let us talk about cats."))
    assert "bridge back" in flow.note().lower()
    await flow.change("resume")
    assert flow.phase == "teaching" and not flow.quiet
    assert [t.text for t in flow.turns] == ["I would like tea."]
    assert flow.step["id"] == "learn"


async def test_failed_save_never_advances_and_retries_use_same_attempt_id():
    attempts = []

    async def save(unit, step, turns, attempt_id):
        attempts.append(attempt_id)
        return None

    flow = StudyFlow(UNIT, save=save)
    await flow.change("start")
    flow.observe(Turn("user", "Tea please."))
    assert "saved" not in (await flow.change("finish")).lower()
    assert flow.step["id"] == "learn"
    await flow.change("finish")
    assert len(attempts) == 2 and attempts[0] == attempts[1]


async def test_finish_waits_for_persisted_result_then_offers_break_before_next():
    updated = {**UNIT, "session_progress": {"learn": {"status": "mastered"}}}

    async def save(*args):
        return updated

    flow = StudyFlow(UNIT, save=save)
    await flow.change("start")
    flow.observe(Turn("user", "Tea please."))
    await flow.change("finish")
    assert flow.phase == "between" and flow.step["id"] == "check"
    assert not flow.turns
    assert "independent" in flow.note().lower()
    await flow.change("resume")
    assert flow.phase == "teaching"


async def test_empty_chat_cannot_finish_or_score_a_lesson():
    called = []

    async def save(*args):
        called.append(True)

    flow = StudyFlow(UNIT, save=save)
    flow.observe(Turn("user", "Hi!"))
    await flow.change("finish")
    await flow.change("start")
    await flow.change("finish")
    assert not called


async def test_completed_lesson_can_be_reviewed_without_erasing_progress():
    unit = {
        **UNIT,
        "status": "mastered",
        "session_progress": {
            "learn": {"status": "mastered"},
            "check": {"status": "mastered"},
        },
    }
    flow = StudyFlow(unit)
    assert flow.review_mode and flow.phase == "welcome"
    assert flow.step["id"] == "check"
    await flow.change("start")
    assert flow.phase == "teaching"


async def test_spoken_dictation_is_not_evidence_of_spelling():
    unit = deepcopy(UNIT)
    unit["content"]["sessions"][0]["activity"] = "dictation"
    calls = []

    async def save(*args):
        calls.append(args)
        return None

    flow = StudyFlow(unit, save=save)
    await flow.change("start")
    flow.observe(Turn("user", "The dog runs."))
    assert "typed" in (await flow.change("finish")).lower()
    assert not calls
    flow.record_written("The dog runs.")
    flow.observe(Turn("user", "The dog runs."))
    await flow.change("finish")
    assert "[Written response]" in calls[0][2][-1].text


@pytest.mark.parametrize("kind", ["exam", "practice"])
async def test_mixed_session_with_writing_goal_requires_typed_evidence(kind):
    unit = deepcopy(UNIT)
    unit["goals"].append(
        {"id": "u1-g2", "kind": "writing", "text": "Write an invitation"}
    )
    step = unit["content"]["sessions"][0]
    step.update(kind=kind, activity="mixed", goal_ids=["u1-g1", "u1-g2"])
    calls = []

    async def save(*args):
        calls.append(args)
        return None

    flow = StudyFlow(unit, save=save)
    await flow.change("start")
    flow.observe(Turn("user", "Come to my party."))
    assert "typed" in (await flow.change("finish")).lower()
    assert not calls
    flow.record_written("Come to my party on Friday.")
    flow.observe(Turn("user", "Come to my party on Friday."))
    await flow.change("finish")
    assert len(calls) == 1
    assert calls[0][2][-1].text.startswith("[Written response]")


async def test_writing_goal_in_another_session_does_not_block_speaking():
    unit = deepcopy(UNIT)
    unit["goals"].append(
        {"id": "u1-g2", "kind": "writing", "text": "Write an invitation"}
    )
    calls = []

    async def save(*args):
        calls.append(args)
        return None

    flow = StudyFlow(unit, save=save)
    await flow.change("start")
    flow.observe(Turn("user", "Tea please."))
    await flow.change("finish")
    assert len(calls) == 1
