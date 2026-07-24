from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping


class AgentParseError(ValueError):
    """Raised when an agent definition file cannot be parsed safely."""


@dataclass(frozen=True)
class AgentDefinition:
    slug: str
    name: str
    description: str
    prompt: str
    skills: tuple[str, ...]
    mcps: tuple[str, ...]
    tools_allowed: tuple[str, ...]
    tools_denied: tuple[str, ...]
    harness_overrides: Mapping[str, Mapping[str, str]]
    path: Path
    fingerprint: str

    @property
    def ref(self) -> str:
        return self.slug

    @property
    def harnesses(self) -> tuple[str, ...]:
        return tuple(sorted(self.harness_overrides))


@dataclass(frozen=True)
class ResolvedSkill:
    alias: str
    declared_name: str
    revision: str
    document: str


@dataclass(frozen=True)
class CompiledAgentArtifact:
    agent_ref: str
    harness: str
    target_path: Path
    content: str
    resolved_skills: tuple[ResolvedSkill, ...]
    degradations: tuple[str, ...] = field(default_factory=tuple)


class AgentCompileError(ValueError):
    """Raised when an agent cannot be compiled for a harness."""


__all__ = [
    "AgentCompileError",
    "AgentDefinition",
    "AgentParseError",
    "CompiledAgentArtifact",
    "ResolvedSkill",
]
