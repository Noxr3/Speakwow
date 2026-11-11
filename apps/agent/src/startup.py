"""Per-call context reads; private learner state is never cached across calls."""

from __future__ import annotations

import asyncio


async def load_startup_snapshot(memory, student_id, course_id=None, unit_id=None):
    snapshot, texts = await asyncio.gather(
        memory.load_snapshot(student_id), memory.recent_texts(student_id)
    )
    if snapshot is not None:
        snapshot = {**snapshot}
        if texts:
            snapshot["recent_texts"] = texts
    if course_id and unit_id:
        current = (snapshot or {}).get("current_course") or {}
        unit = current.get("current_unit") or {}
        # The signed dispatch and freshly authenticated student snapshot must agree.
        # Legacy units need study_unit's normalized default session definitions.
        sessions = (unit.get("content") or {}).get("sessions")
        if current.get("id") == course_id and unit.get("id") == unit_id and sessions:
            return snapshot, True
        selected = await memory.load_study_course(student_id, course_id, unit_id)
        if not selected:
            return snapshot, False
        snapshot = {**(snapshot or {}), "current_course": selected}
    return snapshot, True
