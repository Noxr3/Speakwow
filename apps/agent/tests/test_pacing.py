import asyncio

from pacing import (
    SILENCE_STEPS,
    WARM_UP_SILENCE_STEPS,
    SilenceLadder,
    student_share,
    warm_up_silence_steps,
)
from reflect import Turn


def _ladder() -> tuple[SilenceLadder, list[str]]:
    said: list[str] = []

    async def nudge(note: str) -> None:
        said.append(note)

    return SilenceLadder(nudge, delays=(0.02, 0.02, 0.02)), said


async def _quiet_round(ladder: SilenceLadder) -> None:
    """The teacher speaks a nudge, then listens again into the silence."""
    ladder.on_agent_state("speaking")
    ladder.on_agent_state("listening")
    await asyncio.sleep(0.05)


async def test_quiet_student_gets_help_then_reassurance_then_a_way_back() -> None:
    ladder, said = _ladder()
    ladder.on_agent_state("listening")
    await asyncio.sleep(0.05)
    assert said == [SILENCE_STEPS[0]]
    await _quiet_round(ladder)
    await _quiet_round(ladder)
    assert said == list(SILENCE_STEPS)  # help, one "no rush", then re-open
    await _quiet_round(ladder)
    assert said == list(SILENCE_STEPS), "after the re-open, leave them be"
    ladder.close()


async def test_a_call_gets_one_no_rush_then_later_silences_reopen() -> None:
    ladder, said = _ladder()
    ladder.on_agent_state("listening")
    await asyncio.sleep(0.05)
    await _quiet_round(ladder)
    ladder.on_user_state("speaking")  # they answer, then go quiet again
    ladder.on_user_state("listening")
    await asyncio.sleep(0.05)
    await _quiet_round(ladder)
    assert said == [
        SILENCE_STEPS[0],
        SILENCE_STEPS[1],
        SILENCE_STEPS[0],
        SILENCE_STEPS[2],
    ]
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


def test_only_the_one_reassurance_ends_without_a_hand_off() -> None:
    for steps in (SILENCE_STEPS, warm_up_silence_steps("x")):
        assert all("are you there" not in step.lower() for step in steps)
        help_, reassure, reopen = steps
        assert "This once, no question" in reassure
        assert "choice" in help_ and "choice" in reopen


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


def test_warm_up_steps_never_teach() -> None:
    for step in WARM_UP_SILENCE_STEPS:
        assert "are you there" not in step.lower()
        assert "start of a sentence" not in step and "say it more simply" not in step
    assert "not a lesson" in WARM_UP_SILENCE_STEPS[0]


async def test_the_ladder_reads_its_steps_when_a_step_fires() -> None:
    said: list[str] = []
    phase = {"steps": WARM_UP_SILENCE_STEPS}

    async def nudge(note: str) -> None:
        said.append(note)

    ladder = SilenceLadder(nudge, delays=(0.02, 0.02), steps=lambda: phase["steps"])
    ladder.on_agent_state("listening")
    await asyncio.sleep(0.05)
    assert said == [WARM_UP_SILENCE_STEPS[0]]
    phase["steps"] = SILENCE_STEPS  # the lesson has started
    ladder.on_user_state("speaking")
    ladder.on_user_state("listening")
    await asyncio.sleep(0.05)
    assert said[-1] == SILENCE_STEPS[0]
    ladder.close()


async def test_a_nudge_after_the_call_ended_is_dropped_quietly() -> None:
    async def nudge(note: str) -> None:
        raise RuntimeError("AgentSession isn't running")

    ladder = SilenceLadder(nudge, delays=(0.01, 0.01))
    ladder.on_agent_state("listening")
    await asyncio.sleep(0.03)  # would surface as "Task exception was never retrieved"
    ladder.close()


def test_a_shy_student_hears_the_teachers_own_news_first() -> None:
    from datetime import date

    from life import news_today
    from personas import load_personas

    lily = load_personas()["lily"]
    news = news_today(lily, date(2026, 10, 16))
    assert news and news in warm_up_silence_steps(news)[0]
    assert "Go first" in warm_up_silence_steps(None)[0]


def test_a_goodbye_ends_the_nudging() -> None:
    from pacing import said_goodbye

    assert said_goodbye("OK, bye!") and said_goodbye("Goodbye, Ming.")
    assert said_goodbye("拜拜") and said_goodbye("See you next time")
    assert not said_goodbye("I bought a new bike") and not said_goodbye(None)
