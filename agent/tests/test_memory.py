import json

import httpx

from memory import FileMemory, SupabaseMemory, make_memory

# --- FileMemory ------------------------------------------------------------


async def test_add_and_read_back(tmp_path) -> None:
    mem = FileMemory("brad", directory=tmp_path)
    assert await mem.facts() == []
    assert await mem.add("Brad 喜欢黑咖啡不加糖") is True
    assert await mem.facts() == ["Brad 喜欢黑咖啡不加糖"]


async def test_persists_across_instances(tmp_path) -> None:
    await FileMemory("brad", directory=tmp_path).add("Brad 在 Cobo 工作")
    assert await FileMemory("brad", directory=tmp_path).facts() == ["Brad 在 Cobo 工作"]


async def test_dedup_exact(tmp_path) -> None:
    mem = FileMemory("brad", directory=tmp_path)
    assert await mem.add("Brad 养了一只猫") is True
    assert await mem.add("Brad 养了一只猫") is False
    assert await mem.facts() == ["Brad 养了一只猫"]


async def test_blank_facts_ignored(tmp_path) -> None:
    mem = FileMemory("brad", directory=tmp_path)
    assert await mem.add("   ") is False
    assert await mem.facts() == []


async def test_forget_by_substring(tmp_path) -> None:
    mem = FileMemory("brad", directory=tmp_path)
    await mem.add("Brad 喜欢黑咖啡")
    await mem.add("Brad 讨厌芥末")
    assert await mem.forget("咖啡") == ["Brad 喜欢黑咖啡"]
    assert await mem.facts() == ["Brad 讨厌芥末"]


async def test_forget_no_match(tmp_path) -> None:
    mem = FileMemory("brad", directory=tmp_path)
    await mem.add("Brad 讨厌芥末")
    assert await mem.forget("咖啡") == []
    assert await mem.facts() == ["Brad 讨厌芥末"]


async def test_corrupt_file_treated_as_empty(tmp_path) -> None:
    mem = FileMemory("brad", directory=tmp_path)
    (tmp_path / "brad.json").write_text("{ not json", encoding="utf-8")
    assert await mem.facts() == []
    assert await mem.add("Brad 喜欢狗") is True
    assert await mem.facts() == ["Brad 喜欢狗"]


async def test_as_prompt(tmp_path) -> None:
    mem = FileMemory("brad", directory=tmp_path)
    assert await mem.as_prompt() == ""
    await mem.add("Brad 喜欢黑咖啡")
    await mem.add("Brad 在 Cobo 工作")
    assert await mem.as_prompt() == "- Brad 喜欢黑咖啡\n- Brad 在 Cobo 工作"


async def test_owner_with_path_separators_stays_in_directory(tmp_path) -> None:
    mem = FileMemory("../../etc/passwd", directory=tmp_path)
    await mem.add("x")
    files = list(tmp_path.iterdir())
    assert len(files) == 1
    assert files[0].parent == tmp_path


async def test_blank_owner_falls_back_to_anonymous(tmp_path) -> None:
    await FileMemory("   ", directory=tmp_path).add("x")
    assert (tmp_path / "anonymous.json").exists()


async def test_per_user_isolation_via_owner(tmp_path) -> None:
    await FileMemory("user-aaa", directory=tmp_path).add("fact a")
    await FileMemory("user-bbb", directory=tmp_path).add("fact b")
    assert await FileMemory("user-aaa", directory=tmp_path).facts() == ["fact a"]
    assert await FileMemory("user-bbb", directory=tmp_path).facts() == ["fact b"]


# --- SupabaseMemory (offline via MockTransport) ----------------------------


def _supabase(handler) -> SupabaseMemory:
    return SupabaseMemory(
        "user-123",
        url="https://proj.supabase.co",
        key="service-key",
        transport=httpx.MockTransport(handler),
    )


async def test_supabase_facts_parses_rows() -> None:
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["url"] = str(request.url)
        seen["apikey"] = request.headers.get("apikey")
        return httpx.Response(
            200, json=[{"fact": "likes coffee"}, {"fact": "lives in SF"}]
        )

    mem = _supabase(handler)
    assert await mem.facts() == ["likes coffee", "lives in SF"]
    assert seen["method"] == "GET"
    assert "user_id=eq.user-123" in seen["url"]
    assert seen["apikey"] == "service-key"


async def test_supabase_add_returns_true_when_inserted() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        body = json.loads(request.content)
        assert body == [{"user_id": "user-123", "fact": "likes coffee"}]
        return httpx.Response(201, json=[{"fact": "likes coffee"}])

    assert await _supabase(handler).add("likes coffee") is True


async def test_supabase_add_returns_false_on_duplicate() -> None:
    # ignore-duplicates → empty representation when the row already exists.
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(201, json=[])

    assert await _supabase(handler).add("likes coffee") is False


async def test_supabase_add_blank_skips_request() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("should not call network for blank fact")

    assert await _supabase(handler).add("   ") is False


async def test_supabase_forget_returns_deleted() -> None:
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["method"] = request.method
        seen["url"] = str(request.url)
        return httpx.Response(200, json=[{"fact": "likes coffee"}])

    assert await _supabase(handler).forget("coffee") == ["likes coffee"]
    assert seen["method"] == "DELETE"
    assert "fact=ilike" in seen["url"]


async def test_supabase_degrades_to_empty_on_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    mem = _supabase(handler)
    assert await mem.facts() == []
    assert await mem.add("x") is False
    assert await mem.forget("x") == []


# --- factory ---------------------------------------------------------------


def test_make_memory_uses_file_without_env(monkeypatch) -> None:
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    assert isinstance(make_memory("u"), FileMemory)


def test_make_memory_uses_supabase_with_env(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    assert isinstance(make_memory("u"), SupabaseMemory)
