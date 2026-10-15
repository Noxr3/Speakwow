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
from datetime import datetime, timezone

import httpx

from lesson import updated_progress
from reflect import CEFR_LEVELS, Reflection, Turn

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

    async def start_session(
        self,
        student_id: str,
        persona_id: str,
        room_name: str | None,
        mode: str = "free",
        unit_id: str | None = None,
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
            },
        )
        rows = res.json() if res is not None else None
        return rows[0]["id"] if isinstance(rows, list) and rows else None

    async def finish_session(
        self,
        *,
        student_id: str,
        session_id: str,
        turns: list[Turn],
        reflection: Reflection | None,
        known_level: str | None,
        lesson: dict | None = None,
    ) -> None:
        """lesson: {"course_id", "unit"} from the snapshot when in course mode."""
        messages = [
            {"session_id": session_id, "role": t.role, "content": t.text}
            for t in turns
            if t.role in ("user", "assistant") and t.text.strip()
        ]
        if messages:
            await self._request("POST", "/messages", json=messages)

        patch: dict = {"ended_at": _now()}
        if reflection:
            patch["summary"] = reflection.summary
        await self._request("PATCH", f"/sessions?id=eq.{session_id}", json=patch)

        if not reflection:
            return
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
        if reflection.facts:
            await self._request(
                "POST",
                "/student_facts",
                json=[
                    {"student_id": student_id, "fact": fact, "session_id": session_id}
                    for fact in reflection.facts
                ],
            )
        if lesson and reflection.goal_scores:
            await self._record_unit_progress(student_id, lesson, reflection.goal_scores)
        # One lesson is thin evidence for a level, so it only fills a blank;
        # it never overwrites a level a teacher or a placement test set.
        if not known_level and reflection.level in CEFR_LEVELS:
            await self._request(
                "PATCH",
                f"/profiles?id=eq.{student_id}",
                json={"level": reflection.level},
            )

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
