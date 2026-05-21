"""Per-user memory for the assistant.

A memory store holds short atomic facts about one user ("Brad 喜欢黑咖啡不加糖").
Two backends share one async interface:

- SupabaseMemory: rows in a Postgres `agent_memory` table via PostgREST. Durable
  and shared across all agent replicas. Used in production.
- FileMemory: one JSON file per owner. Used for local dev / when Supabase env
  vars are absent.

`make_memory(owner)` picks the backend from the environment.

Reads happen once per session (facts injected into the system prompt at start),
writes only when the agent calls remember/forget — never per turn — so backend
latency is not on the conversational hot path.
"""

import json
import logging
import os
import re
import tempfile
from pathlib import Path

import httpx

logger = logging.getLogger("memory")

# File backend: owner is external input (the user id), so confine it to a safe
# filename — no path separators, no traversal.
_UNSAFE = re.compile(r"[^A-Za-z0-9_-]")


def _safe_owner(owner: str) -> str:
    cleaned = _UNSAFE.sub("_", (owner or "").strip())[:128]
    return cleaned or "anonymous"


def _render(facts: list[str]) -> str:
    """Facts as a bullet list for system-prompt injection, "" if none."""
    return "\n".join(f"- {f}" for f in facts)


class FileMemory:
    def __init__(self, owner: str, *, directory: str | Path | None = None) -> None:
        directory = directory or os.getenv("MEMORY_DIR", ".memory")
        self._dir = Path(directory)
        self._path = self._dir / f"{_safe_owner(owner)}.json"

    async def facts(self) -> list[str]:
        try:
            raw = self._path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return []
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning("corrupt memory file %s — treating as empty", self._path)
            return []
        return [f for f in data.get("facts", []) if isinstance(f, str)]

    async def add(self, fact: str) -> bool:
        fact = fact.strip()
        if not fact:
            return False
        facts = await self.facts()
        if fact in facts:
            return False
        facts.append(fact)
        self._write(facts)
        return True

    async def forget(self, query: str) -> list[str]:
        query = query.strip().lower()
        if not query:
            return []
        kept: list[str] = []
        removed: list[str] = []
        for f in await self.facts():
            (removed if query in f.lower() else kept).append(f)
        if removed:
            self._write(kept)
        return removed

    async def as_prompt(self) -> str:
        return _render(await self.facts())

    def _write(self, facts: list[str]) -> None:
        self._dir.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self._dir, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump({"facts": facts}, fh, ensure_ascii=False, indent=2)
            os.replace(tmp, self._path)
        except BaseException:
            os.unlink(tmp)
            raise


class SupabaseMemory:
    """Facts stored in a Postgres `agent_memory` table, accessed via PostgREST.

    Calls degrade gracefully: a Supabase hiccup must never break a voice
    session, so reads return [] and writes report failure rather than raising.
    """

    def __init__(
        self,
        owner: str,
        *,
        url: str,
        key: str,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._owner = owner or "anonymous"
        self._endpoint = url.rstrip("/") + "/rest/v1/agent_memory"
        self._headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=10.0, transport=self._transport)

    async def facts(self) -> list[str]:
        try:
            async with self._client() as client:
                resp = await client.get(
                    self._endpoint,
                    params={
                        "user_id": f"eq.{self._owner}",
                        "select": "fact",
                        "order": "created_at.asc",
                    },
                    headers=self._headers,
                )
                resp.raise_for_status()
                return [
                    r["fact"] for r in resp.json() if isinstance(r.get("fact"), str)
                ]
        except Exception:
            logger.exception("supabase facts() failed — degrading to empty memory")
            return []

    async def add(self, fact: str) -> bool:
        fact = fact.strip()
        if not fact:
            return False
        try:
            async with self._client() as client:
                resp = await client.post(
                    self._endpoint,
                    headers={
                        **self._headers,
                        "Prefer": "resolution=ignore-duplicates,return=representation",
                    },
                    json=[{"user_id": self._owner, "fact": fact}],
                )
                resp.raise_for_status()
                # ignore-duplicates returns only newly inserted rows.
                return len(resp.json()) > 0
        except Exception:
            logger.exception("supabase add() failed")
            return False

    async def forget(self, query: str) -> list[str]:
        query = query.strip()
        if not query:
            return []
        try:
            async with self._client() as client:
                resp = await client.request(
                    "DELETE",
                    self._endpoint,
                    params={
                        "user_id": f"eq.{self._owner}",
                        "fact": f"ilike.*{query}*",
                    },
                    headers={**self._headers, "Prefer": "return=representation"},
                )
                resp.raise_for_status()
                return [
                    r["fact"] for r in resp.json() if isinstance(r.get("fact"), str)
                ]
        except Exception:
            logger.exception("supabase forget() failed")
            return []

    async def as_prompt(self) -> str:
        return _render(await self.facts())


def make_memory(owner: str) -> FileMemory | SupabaseMemory:
    """Pick the backend from the environment: Supabase if configured, else file."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if url and key:
        return SupabaseMemory(owner, url=url, key=key)
    return FileMemory(owner)
