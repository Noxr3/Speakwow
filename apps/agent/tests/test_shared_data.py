"""packages/shared is the one source of persona and sticker data."""

import json
import re
from pathlib import Path

from personas import load_personas
from stickers import load_stickers

ROOT = Path(__file__).resolve().parents[3]
SHARED = ROOT / "packages" / "shared"
VENDORED = ROOT / "apps" / "agent" / "shared"
REQUIRED = ["id", "display_name", "tagline_en", "personality", "openings", "voices"]


def _files(base: Path) -> dict[str, str]:
    paths = [
        *sorted((base / "personas").glob("*.json")),
        base / "stickers.json",
        base / "retired-personas.json",
    ]
    return {
        p.relative_to(base).as_posix(): p.read_text(encoding="utf-8") for p in paths
    }


def test_vendored_copy_matches_packages_shared() -> None:
    assert _files(VENDORED) == _files(SHARED), "run `pnpm shared:sync`"


def test_persona_cards_are_complete() -> None:
    for path in sorted((SHARED / "personas").glob("*.json")):
        card = json.loads(path.read_text(encoding="utf-8"))
        missing = [f for f in REQUIRED if f not in card]
        assert not missing, f"{path.name} missing {missing}"
        assert card["id"] == path.stem
        openings = card["openings"]
        assert openings.get("greeting") and openings.get("welcome_back"), path.name
        # The hello ends without a question, so the student gets to say hello
        # back; tone lines are copied closely, so they carry no question either.
        for line in (
            openings["greeting"] + openings["welcome_back"] + card["tone_lines"]
        ):
            assert "?" not in line, f"{path.name}: {line}"
        # A hello says who the teacher is, never what: the page says it is an
        # AI, and the teacher says so only when the student asks.
        for line in openings["greeting"]:
            assert card["display_name"] in line, f"{path.name}: {line}"
        for line in (
            openings["greeting"] + openings["welcome_back"] + card["tone_lines"]
        ):
            assert not re.search(r"\bAI\b", line), f"{path.name}: {line}"
        # activities are what to do, read mid-lesson: never a hello
        for activity in card.get("activities", []):
            assert f"I'm {card['display_name']}" not in activity, activity
            assert not re.match(r"(hi|hey|hello|hiya|yo|g'day)\b", activity, re.I), (
                activity
            )
        assert card.get("voice_note"), f"{path.name} has no voice_note"
        assert set(card["voices"]) <= {"xai", "openai"}
        for thread in card.get("life", {}).get("threads", []):
            assert thread["title"] and thread["beats"], (
                f"{path.name}: empty life thread"
            )


def test_four_teachers_each_with_a_voice_of_their_own() -> None:
    personas = load_personas(SHARED / "personas")
    assert set(personas) == {"frank", "lily", "grace", "leo"}
    assert personas["frank"].voices["xai"] == "Rex"
    # ten teachers shared five voices; four get one each, in both providers
    for provider in ("xai", "openai"):
        voices = [p.voices[provider] for p in personas.values()]
        assert len(voices) == len(set(voices)), (provider, voices)


def test_every_retired_teacher_has_a_living_heir() -> None:
    personas = load_personas(SHARED / "personas")
    retired = json.loads((SHARED / "retired-personas.json").read_text())["replacements"]
    assert retired, "the retired list is empty"
    for old, heir in retired.items():
        assert old not in personas, f"{old} is retired but still a teacher"
        assert heir in personas, f"{old} -> {heir}, who is not a teacher"


def test_sticker_ids_are_unique_and_described() -> None:
    stickers = load_stickers(SHARED / "stickers.json")
    ids = [s["id"] for s in stickers]
    assert len(ids) == len(set(ids))
    for s in stickers:
        assert s["emoji"] and s["code"] and s["when"], s["id"]
