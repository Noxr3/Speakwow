"""Course mode: teach the student's current textbook unit, then score it.

The student's learning record (学习档案) holds their course, current unit and
a score per unit goal. A lesson works through the weakest goals; after the
call the reflection scores the goals the student actually practised, and the
unit advances once every goal is solid.
"""

from __future__ import annotations

from typing import Any

from promptdata import as_data

MASTERED_AT = 0.8
REVIEWING_AT = 0.5
# New evidence counts a little more than the past, so progress shows quickly
# but one bad day does not wipe out a unit.
NEW_WEIGHT = 0.6


def current_unit(snapshot: dict | None) -> dict | None:
    course = (snapshot or {}).get("current_course") or {}
    unit = course.get("current_unit")
    return unit if isinstance(unit, dict) and unit.get("id") else None


def unit_goals(unit: dict | None) -> list[dict]:
    goals = (unit or {}).get("goals")
    return (
        [g for g in goals if isinstance(g, dict) and g.get("id")]
        if isinstance(goals, list)
        else []
    )


def _join(items: Any, limit: int = 12) -> str:
    return ", ".join(str(i) for i in items[:limit]) if isinstance(items, list) else ""


def lesson_section(snapshot: dict | None) -> str | None:
    unit = current_unit(snapshot)
    if not unit:
        return None
    course = snapshot["current_course"]
    scores = unit.get("goal_scores") or {}
    goals = sorted(unit_goals(unit), key=lambda g: scores.get(g["id"], 0))
    goal_lines = "\n".join(
        f"- [{g['id']}] ({g.get('kind', 'skill')}) {g.get('text', '')}"
        f" (so far: {round(float(scores.get(g['id'], 0)) * 100)}%)"
        for g in goals
    )
    content = unit.get("content") or {}
    # courses/ pages use subject-neutral names; rows imported before them
    # still say vocabulary / grammar / speaking_tasks.
    material = [
        f"{label}: {text}"
        for label, text in (
            (
                "Key words and terms",
                _join(content.get("terms") or content.get("vocabulary")),
            ),
            ("Key points", _join(content.get("points") or content.get("grammar"))),
            (
                "Things to do together",
                "; ".join(
                    content.get("activities") or content.get("speaking_tasks") or []
                ),
            ),
            ("Common mistakes to watch for", "; ".join(content.get("pitfalls") or [])),
        )
        if text
    ]
    header = f'Unit {unit.get("position")} "{unit.get("title")}"'
    if unit.get("theme") or unit.get("topic"):
        header += (
            f" ({' / '.join(x for x in (unit.get('theme'), unit.get('topic')) if x)})"
        )
    body = "\n".join(
        [
            f"Course: {course.get('title')}. Current unit: {header}.",
            f"Unit mastery so far: {round(float(unit.get('mastery') or 0) * 100)}% "
            f"after {unit.get('sessions') or 0} lessons.",
            "Goals, weakest first:",
            goal_lines or "- (no goals listed: practise the unit's topic)",
            *material,
        ]
    )
    return f"""## Today's lesson
This is a lesson from the student's course. Teach it the way you always
talk: through real conversation, not drills or lectures, and in the order of
"How the conversation goes" above.
- Check learning by having them use what they learn (say it, explain it,
  apply it), never by asking "do you understand?".
<lesson_plan>
{as_data(body)}
</lesson_plan>"""


def updated_progress(
    previous: dict | None, goals: list[dict], new_scores: dict[str, float]
) -> dict:
    """The unit_progress row after one lesson."""
    previous = previous or {}
    scores: dict[str, float] = {
        k: float(v) for k, v in (previous.get("goal_scores") or {}).items()
    }
    for goal_id, score in new_scores.items():
        old = scores.get(goal_id)
        scores[goal_id] = round(
            score if old is None else old * (1 - NEW_WEIGHT) + score * NEW_WEIGHT, 3
        )
    ids = [g["id"] for g in goals]
    mastery = round(sum(scores.get(i, 0.0) for i in ids) / len(ids), 3) if ids else 0.0
    if ids and all(scores.get(i, 0.0) >= MASTERED_AT for i in ids):
        status = "mastered"
    elif mastery >= REVIEWING_AT:
        status = "reviewing"
    else:
        status = "learning"
    return {
        "goal_scores": scores,
        "mastery": mastery,
        "status": status,
        "sessions": int(previous.get("sessions") or 0) + 1,
    }
