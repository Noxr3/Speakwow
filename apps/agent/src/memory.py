"""Long-term memory: what the teacher knows about a student across sessions.

Backed by Supabase's REST API with the service-role key (agent only, never
the browser). Memory is best effort by design: every call logs and returns
None on failure, so a database hiccup never breaks a live lesson.

    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

from __future__ import annotations

import logging
import os
import re
from datetime import UTC, datetime, timedelta, timezone
from urllib.parse import quote

import httpx

from lesson import updated_progress
from reflect import CEFR_LEVELS, Reflection, Turn
from user_memory import memory_ops

logger = logging.getLogger("speakwow-agent.memory")

UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


def is_uuid(value: object) -> bool:
    return isinstance(value, str) and bool(UUID_RE.match(value))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class SupabaseMemory:
    def __init__(
        self, url: str, service_key: str, client: httpx.AsyncClient | None = None
    ) -> None:
        self.rest = url.rstrip("/") + "/rest/v1"
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }
        self.client = client or httpx.AsyncClient(timeout=10)

    @classmethod
    def from_env(cls) -> SupabaseMemory | None:
        url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            return None
        return cls(url, key)

    async def aclose(self) -> None:
        await self.client.aclose()

    async def _request(self, method: str, path: str, **kwargs) -> httpx.Response | None:
        try:
            res = await self.client.request(
                method,
                f"{self.rest}{path}",
                headers={**self.headers, **kwargs.pop("headers", {})},
                **kwargs,
            )
            res.raise_for_status()
            return res
        except Exception:
            logger.exception("memory %s %s failed", method, path)
            return None

    async def load_snapshot(self, student_id: str) -> dict | None:
        res = await self._request(
            "POST", "/rpc/get_student_snapshot", json={"p_student": student_id}
        )
        data = res.json() if res is not None else None
        return data if isinstance(data, dict) else None

    async def student_for_phone(self, phone: str) -> dict | None:
        """{"student_id", "sms_opted_out"} for a linked number, else None."""
        res = await self._request(
            "GET",
            "/student_phones",
            params={"phone": f"eq.{phone}", "select": "student_id,sms_opted_out"},
        )
        rows = res.json() if res is not None else None
        return rows[0] if isinstance(rows, list) and rows else None

    async def last_persona(self, student_id: str) -> str | None:
        """The teacher this student talked to last, on any channel."""
        res = await self._request(
            "GET",
            "/sessions",
            params={
                "student_id": f"eq.{student_id}",
                "select": "persona_id",
                "order": "started_at.desc.nullslast",
                "limit": "1",
            },
        )
        rows = res.json() if res is not None else None
        return rows[0].get("persona_id") if isinstance(rows, list) and rows else None

    async def recent_texts(
        self, student_id: str, limit: int = 12, days: int = 7
    ) -> list[dict]:
        """The latest text messages with this student, oldest first, so a
        call knows what was said by text and a text knows the last call."""
        since = (datetime.now(UTC) - timedelta(days=days)).isoformat()
        res = await self._request(
            "GET",
            "/messages",
            params={
                "select": "role,content,created_at,sessions!inner(student_id,channel)",
                "sessions.student_id": f"eq.{student_id}",
                "sessions.channel": "in.(sms,whatsapp)",
                "created_at": f"gte.{since}",
                "order": "created_at.desc",
                "limit": str(limit),
            },
        )
        rows = res.json() if res is not None else None
        if not isinstance(rows, list):
            return []
        return [
            {"role": r["role"], "content": r["content"], "at": r["created_at"]}
            for r in reversed(rows)
            if r.get("role") in ("user", "assistant") and r.get("content")
        ]

    async def language_courses(self) -> list[tuple[str, str]]:
        """(slug, title) of the courses a new student can be started on: the
        language ones, which is all the teacher teaches for now."""
        res = await self._request(
            "GET",
            "/courses",
            params={
                "select": "slug,title,subject",
                "order": "slug",
                "source": "eq.repo",
            },
        )
        rows = res.json() if res is not None else None
        if not isinstance(rows, list):
            return []
        return [
            (r["slug"], r["title"])
            for r in rows
            if r.get("slug") and r.get("subject") == "english"
        ]

    async def save_intake(
        self,
        *,
        student_id: str,
        session_id: str,
        memories: list[dict],
        snapshot: list[dict] | None,
        course: str | None = None,
    ) -> bool:
        """The first-call interview (intake.intake_memories): its memories, and
        the course their textbook matches. True when every write went through.
        snapshot: the memories read at the start of the call; without one
        nothing is written (a failed read is not an empty memory)."""
        if snapshot is None:
            return False
        saved = await self._apply_memory_ops(student_id, session_id, memories, snapshot)
        if course and not await self.enroll(student_id, course):
            saved = False
        return saved

    async def enroll(self, student_id: str, slug: str) -> bool:
        """Start the course (at its first unit) and pause any other: the same
        rule as the web's "Start this course"."""
        res = await self._request(
            "GET",
            "/courses",
            params={
                "slug": f"eq.{slug}",
                "select": "id,course_units(id,position)",
                "course_units.order": "position.asc",
                "course_units.limit": "1",
            },
        )
        rows = res.json() if res is not None else None
        if not isinstance(rows, list) or not rows or not rows[0].get("course_units"):
            return False
        course_id, unit_id = rows[0]["id"], rows[0]["course_units"][0]["id"]
        now = datetime.now(UTC).isoformat()
        await self._request(
            "PATCH",
            f"/enrollments?student_id=eq.{student_id}&status=eq.active&course_id=neq.{course_id}",
            json={"status": "paused", "updated_at": now},
        )
        done = await self._request(
            "POST",
            "/enrollments?on_conflict=student_id,course_id",
            headers={"Prefer": "resolution=merge-duplicates"},
            json={
                "student_id": student_id,
                "course_id": course_id,
                "current_unit_id": unit_id,
                "status": "active",
                "updated_at": now,
            },
        )
        return done is not None

    async def set_sms_opt_out(self, phone: str, opted_out: bool) -> None:
        await self._request(
            "PATCH",
            f"/student_phones?phone=eq.{quote(phone)}",
            json={"sms_opted_out": opted_out},
        )

    async def text_session(
        self, student_id: str, persona_id: str, channel: str = "sms"
    ) -> str | None:
        """Today's text conversation with this student on one channel (SMS or
        WhatsApp, UTC day), started on the first text of the day, so texts sit
        in the same history as calls."""
        today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        res = await self._request(
            "GET",
            "/sessions",
            params={
                "student_id": f"eq.{student_id}",
                "channel": f"eq.{channel}",
                "started_at": f"gte.{today.isoformat()}",
                "select": "id",
                "order": "started_at.desc",
                "limit": "1",
            },
        )
        rows = res.json() if res is not None else None
        if isinstance(rows, list) and rows:
            return rows[0]["id"]
        return await self.start_session(student_id, persona_id, None, channel=channel)

    async def count_texts_from(self, session_id: str, limit: int) -> int:
        """How many texts the student sent in this session, counted up to limit."""
        res = await self._request(
            "GET",
            "/messages",
            params={
                "session_id": f"eq.{session_id}",
                "role": "eq.user",
                "select": "id",
                "limit": str(limit),
            },
        )
        rows = res.json() if res is not None else None
        return len(rows) if isinstance(rows, list) else 0

    async def add_messages(self, session_id: str, turns: list[Turn]) -> None:
        rows = [
            {"session_id": session_id, "role": t.role, "content": t.text}
            for t in turns
            if t.text.strip()
        ]
        if rows:
            await self._request("POST", "/messages", json=rows)

    async def start_session(
        self,
        student_id: str,
        persona_id: str,
        room_name: str | None,
        mode: str = "free",
        unit_id: str | None = None,
        channel: str = "web",
    ) -> str | None:
        res = await self._request(
            "POST",
            "/sessions",
            headers={"Prefer": "return=representation"},
            json={
                "student_id": student_id,
                "persona_id": persona_id,
                "room_name": room_name,
                "started_at": _now(),
                "mode": mode,
                "unit_id": unit_id,
                "channel": channel,
            },
        )
        rows = res.json() if res is not None else None
        return rows[0]["id"] if isinstance(rows, list) and rows else None

    async def save_transcript(self, *, session_id: str, turns: list[Turn]) -> None:
        """The call's words and its end, stored first: the reflection after it
        is a slow model call, and a call that ended while it ran used to lose
        everything (production, 2026-10-16: "process did not exit in time")."""
        messages = [
            {"session_id": session_id, "role": t.role, "content": t.text}
            for t in turns
            if t.role in ("user", "assistant") and t.text.strip()
        ]
        if messages:
            await self._request("POST", "/messages", json=messages)
        await self._request(
            "PATCH", f"/sessions?id=eq.{session_id}", json={"ended_at": _now()}
        )

    async def finish_session(
        self,
        *,
        student_id: str,
        session_id: str,
        turns: list[Turn],
        reflection: Reflection | None,
        memory_snapshot: list[dict] | None = None,
        lesson: dict | None = None,
        transcript_saved: bool = False,
    ) -> None:
        """lesson: {"course_id", "unit"} from the snapshot when in course mode.
        transcript_saved: save_transcript already stored the turns."""
        if not transcript_saved:
            await self.save_transcript(session_id=session_id, turns=turns)
        if not reflection:
            return
        await self._request(
            "PATCH",
            f"/sessions?id=eq.{session_id}",
            json={"summary": reflection.summary},
        )
        evidence = {"session_id": session_id}
        if reflection.weaknesses:
            await self._request(
                "POST",
                "/weaknesses",
                json=[
                    {
                        "student_id": student_id,
                        "item": item,
                        "source": "live_session",
                        "evidence": evidence,
                    }
                    for item in reflection.weaknesses
                ],
            )
        if lesson and reflection.goal_scores:
            await self._record_unit_progress(student_id, lesson, reflection.goal_scores)
        # A failed read is not an empty memory. Never write without a snapshot.
        if memory_snapshot is None:
            return
        ops = memory_ops(reflection.memories)
        if (
            reflection.level in CEFR_LEVELS
            and not any(r.get("key") == "english-level" for r in memory_snapshot)
            and not any(op["key"] == "english-level" for op in ops)
        ):
            ops.append(
                {
                    "action": "create",
                    "key": "english-level",
                    "content": f"The student's English was estimated at CEFR {reflection.level} in a lesson.",
                }
            )
        await self._apply_memory_ops(student_id, session_id, ops, memory_snapshot)

    async def _apply_memory_ops(
        self,
        student_id: str,
        session_id: str,
        ops: list[dict],
        snapshot: list[dict],
    ) -> bool:
        """Write memory operations through apply_user_memory (compare-and-set,
        bound to this session). What the user wrote or deleted themselves is
        never touched. False when a request failed."""
        ok = True
        for op in ops:
            previous = next((r for r in snapshot if r.get("key") == op["key"]), None)
            if previous and (
                previous.get("deleted_at") or not previous.get("source_session_id")
            ):
                continue
            if op["action"] == "create" and previous:
                continue
            if op["action"] != "create" and not previous:
                continue
            res = await self._request(
                "POST",
                "/rpc/apply_user_memory",
                json={
                    "p_student": student_id,
                    "p_session": session_id,
                    "p_key": op["key"],
                    "p_action": op["action"],
                    "p_content": op.get("content"),
                    "p_expected_updated_at": previous.get("updated_at")
                    if previous
                    else None,
                },
            )
            ok = ok and res is not None
        return ok

    async def _record_unit_progress(
        self, student_id: str, lesson: dict, scores: dict[str, float]
    ) -> None:
        unit = lesson["unit"]
        goals = [
            g for g in unit.get("goals") or [] if isinstance(g, dict) and g.get("id")
        ]
        row = updated_progress(unit, goals, scores)
        await self._request(
            "POST",
            "/unit_progress?on_conflict=student_id,unit_id",
            headers={"Prefer": "resolution=merge-duplicates"},
            json={
                "student_id": student_id,
                "unit_id": unit["id"],
                "last_studied_at": _now(),
                **row,
            },
        )
        if row["status"] != "mastered":
            return
        # Unit done: move the student's place in the course to the next unit.
        res = await self._request(
            "GET",
            f"/course_units?course_id=eq.{lesson['course_id']}"
            f"&position=gt.{int(unit.get('position') or 0)}&order=position.asc&limit=1&select=id",
        )
        rows = res.json() if res is not None else []
        if rows:
            await self._request(
                "PATCH",
                f"/enrollments?student_id=eq.{student_id}&course_id=eq.{lesson['course_id']}",
                json={"current_unit_id": rows[0]["id"], "updated_at": _now()},
            )
