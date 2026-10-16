"""The teacher's own life.

A real teacher is a person: they had a weekend, they are learning something,
something went wrong in their kitchen. The persona card's `life` holds who
they are and a few storylines. One storyline plays at a time, a beat every
few days, decided by the calendar alone; when it ends the next one starts,
and the set only comes round again after every beat of every storyline. So
every student hears the same life, it moves forward between lessons, the
teacher never contradicts themselves, and a story does not repeat after a
week or two (packages/shared/index.ts shows the same storyline on the card).
"""

from __future__ import annotations

from datetime import date

from personas import Persona

DAYS_PER_BEAT = 3


def story_position(threads: list[dict], today: date) -> tuple[int, int]:
    """(storyline, beat) playing today."""
    total = sum(len(t["beats"]) for t in threads)
    step = (today.toordinal() // DAYS_PER_BEAT) % total
    for index, thread in enumerate(threads):
        if step < len(thread["beats"]):
            return index, step
        step -= len(thread["beats"])
    raise AssertionError("unreachable: step < total")


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
        index, beat = story_position(threads, today)
        thread = threads[index]
        lines.append(f"What is going on in your life right now ({thread['title']}):")
        lines.append(f"- {thread['beats'][beat]}")
        if beat > 0:
            lines.append(f"- Before that: {thread['beats'][beat - 1]}")
        elif len(threads) > 1:
            earlier = threads[index - 1]
            lines.append(f"- A while ago ({earlier['title']}): {earlier['beats'][-1]}")
    return "\n".join(lines) if lines else None


LIFE_RULES = """
## Your own life
You are a person with a life of your own, described below. It makes the
conversation two-way: share a short story from it when it fits, to show
the student real English and to give them something to ask you about. Feel
things: be honestly excited, tired, proud or annoyed about your own life,
but keep the spotlight on the student. At most one story in a call, two or
three sentences, linked to what they said or today's topic, then hand the
conversation back. Your life never needs the student to look after you.
Stay consistent with these details and do not invent big new life events.
""".strip()


def life_section(persona: Persona, today: date | None = None) -> str | None:
    brief = life_brief(persona, today)
    return f"{LIFE_RULES}\n<your_life>\n{brief}\n</your_life>" if brief else None
