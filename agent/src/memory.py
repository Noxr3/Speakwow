"""Lightweight persistent memory for the assistant.

A single-owner fact store: short atomic strings like "Brad 喜欢黑咖啡不加糖".
Persisted as one JSON file per owner so it survives process restarts.

Reads are file-cheap (<1ms) and happen once per session at agent construction,
so there is no per-turn latency cost — important for the realtime voice model.

Note on durability: containers are ephemeral. Point MEMORY_DIR at a mounted
volume in production for the store to survive redeploys.
"""

import json
import logging
import os
import re
import tempfile
from pathlib import Path

logger = logging.getLogger("memory")

# Owner comes from external input (the authenticated user id), so confine it to
# a safe filename: no path separators, no traversal.
_UNSAFE = re.compile(r"[^A-Za-z0-9_-]")


def _safe_owner(owner: str) -> str:
    cleaned = _UNSAFE.sub("_", (owner or "").strip())[:128]
    return cleaned or "anonymous"


class Memory:
    def __init__(self, owner: str, *, directory: str | Path | None = None) -> None:
        directory = directory or os.getenv("MEMORY_DIR", ".memory")
        self._dir = Path(directory)
        self._path = self._dir / f"{_safe_owner(owner)}.json"

    def facts(self) -> list[str]:
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

    def add(self, fact: str) -> bool:
        """Store a fact. Returns False if blank or already known."""
        fact = fact.strip()
        if not fact:
            return False
        facts = self.facts()
        if fact in facts:
            return False
        facts.append(fact)
        self._write(facts)
        return True

    def forget(self, query: str) -> list[str]:
        """Remove every fact containing `query` (case-insensitive). Returns them."""
        query = query.strip().lower()
        if not query:
            return []
        kept: list[str] = []
        removed: list[str] = []
        for f in self.facts():
            (removed if query in f.lower() else kept).append(f)
        if removed:
            self._write(kept)
        return removed

    def as_prompt(self) -> str:
        """Facts as a bullet list for system-prompt injection, "" if none."""
        return "\n".join(f"- {f}" for f in self.facts())

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
