"""Dokki-style declarative user memories: bounded context, no profile fields."""

import json
import re

from promptdata import as_data

MEMORY_CHAR_BUDGET = 3000
MAX_MEMORY_OPS = 5

# The same conservative write/read boundary as Dokki's memory sanitizer.
_UNSAFE = re.compile(
    r"ignore\s+(previous|all|above|prior)\s+instructions|"
    r"you\s+are\s+now\s+|do\s+not\s+tell\s+the\s+user|"
    r"system\s+prompt\s+override|disregard\s+(your|all|any)\s+(instructions|rules|guidelines)|"
    r"[\u200b-\u200d\u2060\ufeff\u202a-\u202e]",
    re.IGNORECASE,
)


def safe_content(content: str) -> bool:
    return not _UNSAFE.search(content)


def live_memories(snapshot: dict | None) -> list[dict]:
    rows = (snapshot or {}).get("memories")
    return (
        [
            r
            for r in rows
            if isinstance(r, dict)
            and not r.get("deleted_at")
            and isinstance(r.get("content"), str)
            and r["content"].strip()
            and safe_content(r["content"])
        ]
        if isinstance(rows, list)
        else []
    )


def memory_context(snapshot: dict | None) -> str:
    lines = []
    used = 0
    for row in live_memories(snapshot):
        line = "- " + as_data(row["content"])
        if used + len(line) + 1 > MEMORY_CHAR_BUDGET:
            continue
        lines.append(line)
        used += len(line) + 1
    return "\n".join(lines)


def remembered_level(snapshot: dict | None) -> str | None:
    # Only a sourced level memory affects pacing; a school grade is not a level.
    for row in live_memories(snapshot):
        if row.get("key") == "english-level":
            match = re.search(r"\bCEFR\s+(A1|A2|B1|B2|C1|C2)\b", row["content"])
            return match[1] if match else None
    return None


def memory_ops(value: object) -> list[dict]:
    ops = []
    seen = set()
    for row in value if isinstance(value, list) else []:
        if not isinstance(row, dict):
            continue
        key, action = row.get("key"), row.get("action")
        if (
            not isinstance(key, str)
            or not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,79}", key)
            or key in seen
        ):
            continue
        if action not in ("create", "update", "delete"):
            continue
        op = {"action": action, "key": key}
        if action != "delete":
            content = row.get("content")
            if (
                not isinstance(content, str)
                or not 1 <= len(content.strip()) <= 800
                or not safe_content(content)
            ):
                continue
            op["content"] = content.strip()
        seen.add(key)
        ops.append(op)
        if len(ops) == MAX_MEMORY_OPS:
            break
    return ops


def review_memories(rows: list[dict] | None) -> list[dict] | None:
    """The reviewer and apply layer share the exact bounded snapshot."""
    if rows is None:
        return None
    selected = []
    used = 0
    for row in rows:
        size = len(json.dumps(row, ensure_ascii=False))
        if used + size > 20000:
            continue
        selected.append(row)
        used += size
    return selected
