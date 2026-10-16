"""Persona cards: who each teacher is and how they talk.

Cards are plain JSON in packages/shared/personas/ — the web picker reads the
same files, so a new teacher is one JSON file. The agent's Docker build
context is apps/agent, so packages/shared is vendored in apps/agent/shared/;
tests/test_shared_data.py fails when the two drift (fix: `pnpm shared:sync`).
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_PERSONA_ID = "frank"

_HERE = Path(__file__).resolve()


@dataclass(frozen=True)
class Persona:
    id: str
    display_name: str
    voices: dict
    accent_tag: str
    language_policy: str
    personality: str
    # Hellos end without a question, so the student can say hello back.
    greetings: tuple[str, ...]
    welcome_backs: tuple[str, ...]
    # Warm-up topics, one at a time, once the hellos are done.
    starters: tuple[str, ...]
    guidance_style: tuple[tuple[str, str], ...]
    life: dict
    voice_note: str = ""
    tone_lines: tuple[str, ...] = ()

    @classmethod
    def from_card(cls, card: dict) -> Persona:
        openings = card.get("openings") or {}
        return cls(
            id=card["id"],
            display_name=card["display_name"],
            # `voice` is the pre-multi-provider field: an xAI voice name.
            voices=card.get("voices") or {"xai": card["voice"]},
            accent_tag=card.get("accent_tag", "en-US"),
            language_policy=card.get("language_policy", ""),
            personality=card["personality"],
            greetings=tuple(openings.get("greeting") or ()),
            welcome_backs=tuple(openings.get("welcome_back") or ()),
            starters=tuple(openings.get("starters") or ()),
            guidance_style=tuple(
                (g["scenario"], g["expression"]) for g in card.get("guidance_style", ())
            ),
            life=card.get("life") or {},
            voice_note=card.get("voice_note", ""),
            tone_lines=tuple(card.get("tone_lines") or ()),
        )


def shared_dirs() -> list[Path]:
    """Where the shared data lives, first match wins."""
    dirs: list[Path] = []
    if env_dir := os.getenv("SPEAKWOW_SHARED_DIR"):
        dirs.append(Path(env_dir))
    # Monorepo checkout: apps/agent/src/personas.py -> <root>/packages/shared
    if len(_HERE.parents) > 3:
        dirs.append(_HERE.parents[3] / "packages" / "shared")
    # Docker image (build context = apps/agent): the vendored copy.
    dirs.append(_HERE.parents[1] / "shared")
    return dirs


def load_personas(directory: Path | None = None) -> dict[str, Persona]:
    candidates = [directory] if directory else [d / "personas" for d in shared_dirs()]
    for candidate in candidates:
        if candidate.is_dir() and any(candidate.glob("*.json")):
            cards = [
                json.loads(path.read_text(encoding="utf-8"))
                for path in sorted(candidate.glob("*.json"))
            ]
            return {card["id"]: Persona.from_card(card) for card in cards}
    raise FileNotFoundError(f"no persona cards found in {candidates}")


def resolve_persona(personas: dict[str, Persona], requested: str | None) -> Persona:
    """Match an id ("lucy") or a legacy display name ("Lucy"); default otherwise."""
    if requested:
        key = requested.strip().lower()
        if key in personas:
            return personas[key]
        for persona in personas.values():
            if persona.display_name.lower() == key:
                return persona
    return personas.get(DEFAULT_PERSONA_ID) or next(iter(personas.values()))
