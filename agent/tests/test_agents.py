import pytest

from base import MemoryAgent
from frank import FRANK
from lucy import LUCY
from memory import FileMemory


def _agent(config, tmp_path, known: str = "") -> MemoryAgent:
    return MemoryAgent(config, FileMemory("x", directory=tmp_path), known)


def _tool_names(agent: MemoryAgent) -> set[str]:
    return {t.info.name for t in agent.tools}


@pytest.mark.parametrize("config", [FRANK, LUCY], ids=["frank", "lucy"])
def test_every_agent_has_shared_memory_tools(config, tmp_path) -> None:
    assert {"remember", "forget"} <= _tool_names(_agent(config, tmp_path))


@pytest.mark.parametrize("config", [FRANK, LUCY], ids=["frank", "lucy"])
def test_known_facts_injected_into_instructions(config, tmp_path) -> None:
    agent = _agent(config, tmp_path, known="- likes black coffee")
    assert config.memory_header in agent.instructions
    assert "likes black coffee" in agent.instructions


@pytest.mark.parametrize("config", [FRANK, LUCY], ids=["frank", "lucy"])
def test_no_memory_header_when_empty(config, tmp_path) -> None:
    assert config.memory_header not in _agent(config, tmp_path).instructions


def test_lucy_keeps_its_specific_tool(tmp_path) -> None:
    assert "call_agent" in _tool_names(_agent(LUCY, tmp_path))


def test_frank_has_no_call_agent(tmp_path) -> None:
    assert "call_agent" not in _tool_names(_agent(FRANK, tmp_path))
