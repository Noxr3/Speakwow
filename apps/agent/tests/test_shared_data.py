"""packages/shared is the one source of persona and sticker data."""

import json
from pathlib import Path

from personas import load_personas
from stickers import load_stickers

ROOT = Path(__file__).resolve().parents[3]
SHARED = ROOT / "packages" / "shared"
VENDORED = ROOT / "apps" / "agent" / "shared"
REQUIRED = ["id", "display_name", "tagline_en", "personality", "openings", "voices"]


def _files(base: Path) -> dict[str, str]:
    paths = [*sorted((base / "personas").glob("*.json")), base / "stickers.json"]
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
        assert card["openings"].get("casual"), f"{path.name} has no casual openings"
        assert set(card["voices"]) <= {"xai", "openai"}
        for thread in card.get("life", {}).get("threads", []):
            assert thread["title"] and thread["beats"], (
                f"{path.name}: empty life thread"
            )


def test_loader_reads_both_teachers() -> None:
    personas = load_personas(SHARED / "personas")
    assert {"frank", "lucy"} <= set(personas)
    assert personas["frank"].voices["xai"] == "Rex"


def test_sticker_ids_are_unique_and_described() -> None:
    stickers = load_stickers(SHARED / "stickers.json")
    ids = [s["id"] for s in stickers]
    assert len(ids) == len(set(ids))
    for s in stickers:
        assert s["emoji"] and s["code"] and s["when"], s["id"]
