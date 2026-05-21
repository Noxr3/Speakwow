"""Shared Memory Agent framework.

Every agent is the same `MemoryAgent`; what differs between them is only
configuration (`AgentConfig`): prompt, voice, memory owner, opening line,
and any agent-specific tools. Memory loading, the remember/forget tools,
and the greeting flow live here once.

Known facts are injected into the system prompt at construction time, so
recall costs zero runtime latency — important for the realtime voice model.
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from livekit.agents import Agent, RunContext, function_tool

from memory import Memory

logger = logging.getLogger("agent")


@dataclass
class AgentConfig:
    name: str
    voice: str
    memory_owner: str
    instructions: str
    # Returns the instruction passed to generate_reply on entry. A callable so
    # agents like Frank can pick a fresh random opening each session.
    opening: Callable[[], str]
    # Header preceding injected memories (language/persona-specific).
    memory_header: str
    # Agent-specific tools, in addition to the shared remember/forget.
    tools: list[Any] = field(default_factory=list)


class MemoryAgent(Agent):
    def __init__(self, config: AgentConfig, memory: Memory | None = None) -> None:
        self.config = config
        self._memory = memory or Memory(config.memory_owner)
        instructions = config.instructions
        known = self._memory.as_prompt()
        if known:
            instructions += f"\n{config.memory_header}\n{known}\n"
        logger.info(
            "%s memory loaded: %d facts", config.name, len(self._memory.facts())
        )
        super().__init__(instructions=instructions, tools=config.tools)

    @function_tool()
    async def remember(self, context: RunContext, fact: str) -> str:
        """Persist a fact about the user, remembered in future conversations.

        Args:
            fact: One short, atomic fact, e.g. "User likes black coffee, no sugar".
        """
        added = self._memory.add(fact)
        logger.info("[%s] remember(%r) -> added=%s", self.config.name, fact, added)
        return "saved" if added else "already known"

    @function_tool()
    async def forget(self, context: RunContext, query: str) -> str:
        """Forget stored facts about the user that match a keyword.

        Args:
            query: Keyword to match; every fact containing it is removed.
        """
        removed = self._memory.forget(query)
        logger.info("[%s] forget(%r) -> removed=%s", self.config.name, query, removed)
        if not removed:
            return "nothing matched"
        return "removed: " + "; ".join(removed)

    async def on_enter(self):
        await self.session.generate_reply(
            instructions=self.config.opening(),
            allow_interruptions=True,
        )
