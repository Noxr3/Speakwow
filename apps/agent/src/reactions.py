"""Reactions: the stickers a student taps during a call.

A tap is a face, not a message. The web sends the sticker's emoji as a chat
line, and handled like typed text it interrupted the teacher and forced a
reply every time: three quick taps made three cut-off replies about "that
emoji" (seen on production, 2026-10-16). Here a tap never interrupts, taps
close together count once, and the teacher answers only while waiting for
the student, in a few words, the way a person answers a face.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable

from pacing import REACTED

logger = logging.getLogger("speakwow.reactions")

# Taps closer together than this are one reaction.
REACTION_WINDOW_S = 1.5
# At most one spoken answer to reactions in this long; more would turn a
# row of taps back into a row of replies.
REACTION_GAP_S = 8.0


def sticker_for(text: str | None, stickers: list[dict]) -> dict | None:
    """The sticker a chat line is, if it is nothing but one sticker's emoji
    (once or repeated)."""
    line = (text or "").strip()
    if not line:
        return None
    for sticker in stickers:
        emoji = sticker.get("emoji") or ""
        if emoji and not line.replace(emoji, "").strip():
            return sticker
    return None


def reaction_note(sticker: dict) -> str:
    return (
        f"The student tapped a reaction instead of speaking: {sticker['emoji']} "
        f"({sticker.get('label', '')}). Answer it the way you would answer a "
        "face across the table: a few warm words in your own voice, then hand "
        "them the turn with one easy question or choice. Never say emoji, "
        "sticker, icon, smiley or reaction, and never describe the picture or "
        "count the taps."
    )


class ReactionInbox:
    """Sorts what the student types: a sticker becomes at most one short
    spoken answer; anything else goes to `typed`, as before."""

    def __init__(
        self,
        stickers: list[dict],
        reply: Callable[[str, str], None],
        typed: Callable[[str], None],
        busy: Callable[[], bool],
        clock: Callable[[], float] = time.monotonic,
        window: float = REACTION_WINDOW_S,
        gap: float = REACTION_GAP_S,
    ) -> None:
        self.stickers = stickers
        self.reply = reply
        self.typed = typed
        self.busy = busy
        self.clock = clock
        self.window = window
        self.gap = gap
        self._latest: dict | None = None
        self._answered_at: float | None = None
        self._timer: asyncio.Task | None = None

    def on_text(self, text: str) -> None:
        sticker = sticker_for(text, self.stickers)
        if sticker is None:
            self.typed(text)
            return
        self._latest = sticker
        if self._timer is not None:
            self._timer.cancel()
        self._timer = asyncio.create_task(self._settle())

    def close(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
            self._timer = None

    async def _settle(self) -> None:
        await asyncio.sleep(self.window)
        self._timer = None
        sticker, self._latest = self._latest, None
        if sticker is None or self.busy():
            return  # mid-sentence, a person keeps talking
        now = self.clock()
        if self._answered_at is not None and now - self._answered_at < self.gap:
            return
        self._answered_at = now
        try:
            self.reply(REACTED.format(emoji=sticker["emoji"]), reaction_note(sticker))
        except Exception:
            logger.exception("reaction reply failed")
