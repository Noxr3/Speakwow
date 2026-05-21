from lucy import Lucy
from memory import Memory


def test_known_facts_injected_into_instructions(tmp_path) -> None:
    mem = Memory("brad", directory=tmp_path)
    mem.add("Brad 喜欢黑咖啡不加糖")
    mem.add("Brad 在 Cobo 工作")

    lucy = Lucy(memory=mem)

    assert "# 你已经知道关于 Brad 的事" in lucy.instructions
    assert "Brad 喜欢黑咖啡不加糖" in lucy.instructions
    assert "Brad 在 Cobo 工作" in lucy.instructions


def test_no_memory_header_when_empty(tmp_path) -> None:
    lucy = Lucy(memory=Memory("brad", directory=tmp_path))
    assert "你已经知道关于 Brad 的事" not in lucy.instructions
