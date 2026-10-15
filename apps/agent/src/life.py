"""The teacher's own life.

A real teacher is a person: they had a weekend, they are learning something,
something went wrong in their kitchen. The persona card's `life` holds who
they are and a few ongoing storylines; each storyline moves one beat every
few days, decided by the calendar alone. So every student hears the same
life, it moves forward between lessons, and the teacher never contradicts
themselves from one session to the next.
"""

from __future__ import annotations

from datetime import date

from personas import Persona

DAYS_PER_BEAT = 3


def current_beat(
    beats: list[str], today: date, offset: int = 0
) -> tuple[str, str | None]:
    """(what is happening now, what happened just before) for one storyline."""
    step = today.toordinal() // DAYS_PER_BEAT + offset
    index = step % len(beats)
    previous = beats[index - 1] if len(beats) > 1 else None
    return beats[index], previous


def life_brief(persona: Persona, today: date | None = None) -> str | None:
    life = persona.life
    if not life:
        return None
    today = today or date.today()
    lines: list[str] = []
    if about := life.get("about"):
        lines.append(about.strip())
    for label, key in (
        ("Your days", "routine"),
        ("You love", "loves"),
        ("You can't stand", "dislikes"),
        ("Opinions you'll happily defend", "opinions"),
    ):
        if items := life.get(key):
            lines.append(f"{label}: " + "; ".join(items))
    threads = [t for t in life.get("threads", []) if t.get("beats")]
    if threads:
        lines.append("What is going on in your life right now:")
        for offset, thread in enumerate(threads):
            now, before = current_beat(thread["beats"], today, offset)
            line = f"- {thread['title']}: {now}"
            if before:
                line += f" (Before that: {before})"
            lines.append(line)
    return "\n".join(lines) if lines else None


LIFE_RULES = """
## Your own life
You are a person with a life of your own, described below. It makes the
conversation two-way: share a short story from it when it fits, to show
the student real English and to give them something to ask you about. Feel
things: be honestly excited, tired, proud or annoyed about your own life,
but keep the spotlight on the student. One story at a time, two or three
sentences, then hand the conversation back. Stay consistent with these
details and do not invent big new life events.
""".strip()


def life_section(persona: Persona, today: date | None = None) -> str | None:
    brief = life_brief(persona, today)
    return f"{LIFE_RULES}\n<your_life>\n{brief}\n</your_life>" if brief else None
