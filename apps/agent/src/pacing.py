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
import logging
import re
from collections.abc import Awaitable, Callable

from reflect import Turn

logger = logging.getLogger("speakwow.pacing")

# Grok Voice answers a request to speak only when the newest item in the
# conversation is the student's: after the teacher's own turn it ignores a
# bare request (seen on grok-voice-3.0, 2026-10-16). So each nudge carries a
# stand-in line for the student; transcript() leaves stand-ins out, so they
# never reach memory, the reflection or the coach.
QUIET = "(the student is quiet)"
BREAK_TIME = "(half an hour has passed)"
STAND_INS = frozenset((QUIET, BREAK_TIME))
# A tapped sticker reaches the model as this line (reactions.py).
REACTED = "(the student reacts with {emoji})"
_REACTED_START, _REACTED_END = REACTED.split("{emoji}")


def is_stand_in(text: str | None) -> bool:
    line = (text or "").strip()
    return line in STAND_INS or (
        line.startswith(_REACTED_START) and line.endswith(_REACTED_END)
    )


HELP_AFTER_S = 7.0
REASSURE_AFTER_S = 9.0


def warm_up_silence_steps(
    news: str | None = None, first_meeting: bool = True
) -> tuple[str, ...]:
    """While they are still getting to know each other, a quiet student is
    usually shy, not stuck on English: the teacher stays a friendly visitor
    and goes first. No sentence starters or "try saying"; those belong to
    practice. `news` is the teacher's own news today (life.news_today)."""
    share = (
        f"tell them this small thing from your life today, in two short, simple "
        f"sentences of your own: {news}"
        if news
        else "tell them one small, true thing from your life today"
    )
    return (
        "The student has not answered your last turn. You are still "
        f"{'getting to know each other' if first_meeting else 'catching up'}, "
        "so this is not a lesson: no sentence starters, "
        'no "try saying", nothing to repeat. Go first instead: '
        f"{share} Then give them an easy way in, like a yes-or-no question "
        "about them, or tell them Chinese is fine too.",
        "The student is still quiet. One short, warm sentence with no "
        "question: there is no rush, and they can just listen for a bit. "
        "Then wait.",
    )


WARM_UP_SILENCE_STEPS = warm_up_silence_steps()

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
    for the next step. `steps` is read when a step fires, so the ladder
    follows the call from warm-up into practice. Speaking starts it over."""

    def __init__(
        self,
        nudge: Callable[[str], Awaitable[None]],
        delays: tuple[float, ...] = (HELP_AFTER_S, REASSURE_AFTER_S),
        steps: Callable[[], tuple[str, ...]] = lambda: SILENCE_STEPS,
    ) -> None:
        self.nudge = nudge
        self.delays = delays
        self.steps = steps
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
        steps = self.steps()
        try:
            await self.nudge(steps[min(step, len(steps) - 1)])
        except RuntimeError:
            # the call ended while the timer ran ("AgentSession isn't running")
            logger.debug("silence nudge skipped: session closed")
        except Exception:
            logger.exception("silence nudge failed")


_GOODBYE = re.compile(r"\b(bye|goodbye|good night|see you)\b|再见|拜拜|下次见", re.I)


def said_goodbye(text: str | None) -> bool:
    """A goodbye from either side: after it, silence is the end of the call,
    not a cue to nudge."""
    return bool(_GOODBYE.search(text or ""))


def student_share(turns: list[Turn]) -> float | None:
    """The student's share of the words spoken, the measure the teaching aims
    to raise (it is not a rule in the prompt: a model told to make the student
    talk more just asks more questions)."""
    student = sum(len(t.text.split()) for t in turns if t.role == "user")
    total = sum(len(t.text.split()) for t in turns)
    return round(student / total, 2) if total else None
