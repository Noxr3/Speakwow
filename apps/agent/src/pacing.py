"""The pace of a call: what the teacher does when the student goes quiet, when
it suggests a break, and how much of the talking the student did.

A quiet student is usually thinking, so the teacher waits; answers grow
several times longer when a teacher waits a few seconds instead of filling
the gap (Rowe's wait-time research). Only when the quiet goes on does the
teacher help, once. If it still goes on, one short reassurance with no
question, and then the teacher leaves them be. It never asks "Are you
there?".
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

from reflect import Turn

# Grok Voice answers a request to speak only when the newest item in the
# conversation is the student's: after the teacher's own turn it ignores a
# bare request (seen on grok-voice-3.0, 2026-10-16). So each nudge carries a
# stand-in line for the student; transcript() leaves stand-ins out, so they
# never reach memory, the reflection or the coach.
QUIET = "(the student is quiet)"
BREAK_TIME = "(half an hour has passed)"
STAND_INS = frozenset((QUIET, BREAK_TIME))


def is_stand_in(text: str | None) -> bool:
    return (text or "").strip() in STAND_INS


HELP_AFTER_S = 7.0
REASSURE_AFTER_S = 9.0

SILENCE_STEPS = (
    "The student has been quiet for a while after your last turn; they may be "
    "stuck. Help once, in one short sentence and with no new question: make it "
    "easier to answer (say it more simply, or give them the start of a "
    "sentence), or tell them they can say it in Chinese first.",
    "The student is still quiet. Say one short, warm sentence that takes the "
    "pressure off, with no question at all: there is no rush, or a tiny thought "
    "of your own about the topic. Then wait.",
)

# Minors' services in China remind about a rest after 30 minutes; a break is
# good teaching for everyone else too.
BREAK_AFTER_S = 30 * 60
BREAK_NOTE = (
    "You have been talking for about half an hour, so it is time for a break. "
    "Close now, as in the Close step: one warm line, one thing they did well "
    "today, one thing to tell you next time, and that a short rest is a good "
    "idea. Then stop."
)


class SilenceLadder:
    """Waits while the student is quiet after the teacher's turn, then asks
    for the next step of SILENCE_STEPS. Speaking starts the ladder over."""

    def __init__(
        self,
        nudge: Callable[[str], Awaitable[None]],
        delays: tuple[float, ...] = (HELP_AFTER_S, REASSURE_AFTER_S),
    ) -> None:
        self.nudge = nudge
        self.delays = delays
        self.step = 0
        self.agent_state = "initializing"
        self.user_state = "listening"
        self._timer: asyncio.Task | None = None

    def on_agent_state(self, state: str) -> None:
        self.agent_state = state
        self._rearm()

    def on_user_state(self, state: str) -> None:
        self.user_state = state
        if state == "speaking":
            self.step = 0
        self._rearm()

    def close(self) -> None:
        self._cancel()

    def _rearm(self) -> None:
        self._cancel()
        if (
            self.agent_state == "listening"
            and self.user_state != "speaking"
            and self.step < len(self.delays)
        ):
            self._timer = asyncio.create_task(self._wait(self.step))

    def _cancel(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

    async def _wait(self, step: int) -> None:
        await asyncio.sleep(self.delays[step])
        self.step = step + 1
        self._timer = None
        await self.nudge(SILENCE_STEPS[min(step, len(SILENCE_STEPS) - 1)])


def student_share(turns: list[Turn]) -> float | None:
    """The student's share of the words spoken, the measure the teaching aims
    to raise (it is not a rule in the prompt: a model told to make the student
    talk more just asks more questions)."""
    student = sum(len(t.text.split()) for t in turns if t.role == "user")
    total = sum(len(t.text.split()) for t in turns)
    return round(student / total, 2) if total else None
