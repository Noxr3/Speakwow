import pytest

from base import MemoryAgent
from frank import FRANK
from lucy import LUCY
from memory import Memory


def _tool_names(agent: MemoryAgent) -> set[str]:
    return {t.info.name for t in agent.tools}


@pytest.mark.parametrize("config", [FRANK, LUCY], ids=["frank", "lucy"])
def test_every_agent_has_shared_memory_tools(config, tmp_path) -> None:
    agent = MemoryAgent(config, memory=Memory("x", directory=tmp_path))
    assert {"remember", "forget"} <= _tool_names(agent)


@pytest.mark.parametrize("config", [FRANK, LUCY], ids=["frank", "lucy"])
def test_known_facts_injected_into_instructions(config, tmp_path) -> None:
    mem = Memory("x", directory=tmp_path)
    mem.add("likes black coffee")
    agent = MemoryAgent(config, memory=mem)
    assert config.memory_header in agent.instructions
    assert "likes black coffee" in agent.instructions


@pytest.mark.parametrize("config", [FRANK, LUCY], ids=["frank", "lucy"])
def test_no_memory_header_when_empty(config, tmp_path) -> None:
    agent = MemoryAgent(config, memory=Memory("x", directory=tmp_path))
    assert config.memory_header not in agent.instructions


def test_lucy_keeps_its_specific_tool(tmp_path) -> None:
    agent = MemoryAgent(LUCY, memory=Memory("x", directory=tmp_path))
    assert "call_agent" in _tool_names(agent)


def test_frank_has_no_call_agent(tmp_path) -> None:
    agent = MemoryAgent(FRANK, memory=Memory("x", directory=tmp_path))
    assert "call_agent" not in _tool_names(agent)
