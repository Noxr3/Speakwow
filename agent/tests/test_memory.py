from memory import Memory


def test_add_and_read_back(tmp_path) -> None:
    mem = Memory("brad", directory=tmp_path)
    assert mem.facts() == []
    assert mem.add("Brad 喜欢黑咖啡不加糖") is True
    assert mem.facts() == ["Brad 喜欢黑咖啡不加糖"]


def test_persists_across_instances(tmp_path) -> None:
    Memory("brad", directory=tmp_path).add("Brad 在 Cobo 工作")
    # A fresh instance (simulating a new session/process) reads the same file.
    assert Memory("brad", directory=tmp_path).facts() == ["Brad 在 Cobo 工作"]


def test_dedup_exact(tmp_path) -> None:
    mem = Memory("brad", directory=tmp_path)
    assert mem.add("Brad 养了一只猫") is True
    assert mem.add("Brad 养了一只猫") is False
    assert mem.facts() == ["Brad 养了一只猫"]


def test_blank_facts_ignored(tmp_path) -> None:
    mem = Memory("brad", directory=tmp_path)
    assert mem.add("   ") is False
    assert mem.facts() == []


def test_forget_by_substring(tmp_path) -> None:
    mem = Memory("brad", directory=tmp_path)
    mem.add("Brad 喜欢黑咖啡")
    mem.add("Brad 讨厌芥末")
    removed = mem.forget("咖啡")
    assert removed == ["Brad 喜欢黑咖啡"]
    assert mem.facts() == ["Brad 讨厌芥末"]


def test_forget_no_match(tmp_path) -> None:
    mem = Memory("brad", directory=tmp_path)
    mem.add("Brad 讨厌芥末")
    assert mem.forget("咖啡") == []
    assert mem.facts() == ["Brad 讨厌芥末"]


def test_owners_are_isolated(tmp_path) -> None:
    Memory("brad", directory=tmp_path).add("a")
    Memory("someone-else", directory=tmp_path).add("b")
    assert Memory("brad", directory=tmp_path).facts() == ["a"]


def test_corrupt_file_treated_as_empty(tmp_path) -> None:
    mem = Memory("brad", directory=tmp_path)
    (tmp_path / "brad.json").write_text("{ not json", encoding="utf-8")
    assert mem.facts() == []
    # And it recovers on the next write.
    assert mem.add("Brad 喜欢狗") is True
    assert mem.facts() == ["Brad 喜欢狗"]


def test_as_prompt_empty(tmp_path) -> None:
    assert Memory("brad", directory=tmp_path).as_prompt() == ""


def test_as_prompt_formats_bullets(tmp_path) -> None:
    mem = Memory("brad", directory=tmp_path)
    mem.add("Brad 喜欢黑咖啡")
    mem.add("Brad 在 Cobo 工作")
    assert mem.as_prompt() == "- Brad 喜欢黑咖啡\n- Brad 在 Cobo 工作"


def test_owner_with_path_separators_stays_in_directory(tmp_path) -> None:
    # A malicious owner must not escape the memory directory.
    mem = Memory("../../etc/passwd", directory=tmp_path)
    mem.add("x")
    files = list(tmp_path.iterdir())
    assert len(files) == 1
    assert files[0].parent == tmp_path


def test_blank_owner_falls_back_to_anonymous(tmp_path) -> None:
    Memory("   ", directory=tmp_path).add("x")
    assert (tmp_path / "anonymous.json").exists()


def test_per_user_isolation_via_owner(tmp_path) -> None:
    Memory("user-aaa", directory=tmp_path).add("fact a")
    Memory("user-bbb", directory=tmp_path).add("fact b")
    assert Memory("user-aaa", directory=tmp_path).facts() == ["fact a"]
    assert Memory("user-bbb", directory=tmp_path).facts() == ["fact b"]
