import asyncio

from pacing import SILENCE_STEPS, SilenceLadder, student_share
from reflect import Turn


def _ladder() -> tuple[SilenceLadder, list[str]]:
    said: list[str] = []

    async def nudge(note: str) -> None:
        said.append(note)

    return SilenceLadder(nudge, delays=(0.02, 0.02)), said


async def test_quiet_student_gets_help_then_reassurance_then_peace() -> None:
    ladder, said = _ladder()
    ladder.on_agent_state("listening")
    await asyncio.sleep(0.05)
    assert said == [SILENCE_STEPS[0]]
    # The help is spoken, then the teacher listens again.
    ladder.on_agent_state("speaking")
    ladder.on_agent_state("listening")
    await asyncio.sleep(0.05)
    assert said == list(SILENCE_STEPS)
    ladder.on_agent_state("speaking")
    ladder.on_agent_state("listening")
    await asyncio.sleep(0.05)
    assert said == list(SILENCE_STEPS), "no third nudge: leave them be"
    ladder.close()


async def test_nothing_while_the_teacher_talks_or_the_student_speaks() -> None:
    ladder, said = _ladder()
    ladder.on_agent_state("speaking")
    await asyncio.sleep(0.05)
    ladder.on_agent_state("listening")
    ladder.on_user_state("speaking")
    await asyncio.sleep(0.05)
    assert said == []
    ladder.close()


async def test_speaking_starts_the_ladder_over() -> None:
    ladder, said = _ladder()
    ladder.on_agent_state("listening")
    await asyncio.sleep(0.05)
    ladder.on_user_state("speaking")
    ladder.on_user_state("listening")
    await asyncio.sleep(0.05)
    assert said == [SILENCE_STEPS[0], SILENCE_STEPS[0]]
    ladder.close()


def test_steps_never_ask_are_you_there() -> None:
    for step in SILENCE_STEPS:
        assert "are you there" not in step.lower()
        assert "no new question" in step or "no question" in step


def test_student_share_counts_words() -> None:
    turns = [
        Turn("assistant", "Hello there friend"),
        Turn("user", "Hi I went to the beach"),
    ]
    assert student_share(turns) == 0.67
    assert student_share([]) is None


def test_stand_in_lines_never_reach_the_transcript() -> None:
    from types import SimpleNamespace

    from agent import transcript
    from pacing import BREAK_TIME, QUIET, is_stand_in

    assert is_stand_in(QUIET) and is_stand_in(f" {BREAK_TIME} ")
    assert not is_stand_in("I am quiet today.")
    items = [
        SimpleNamespace(role="assistant", text_content="What did you eat?"),
        SimpleNamespace(role="user", text_content=QUIET),
        SimpleNamespace(role="assistant", text_content="You can start with: I ate…"),
        SimpleNamespace(role="user", text_content="I ate noodles."),
    ]
    turns = transcript(SimpleNamespace(history=SimpleNamespace(items=items)))
    assert [t.text for t in turns if t.role == "user"] == ["I ate noodles."]
