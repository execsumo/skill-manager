from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AgentSummaryResponse(BaseModel):
    ref: str
    slug: str
    name: str
    description: str
    packageSlug: str
    skills: list[str]
    mcps: list[str]
    toolsAllowed: list[str]
    toolsDenied: list[str]
    compileTargets: list[str]


class AgentsPageResponse(BaseModel):
    agents: list[AgentSummaryResponse]
    issues: list[str]


class CompileAgentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    harness: str
    dry_run: bool = Field(default=False, alias="dryRun")
    project_dir: str | None = Field(default=None, alias="projectDir")


class ResolvedSkillResponse(BaseModel):
    alias: str
    name: str
    revision: str


class CompileAgentResponse(BaseModel):
    ok: bool
    agentRef: str
    harness: str
    targetPath: str
    written: bool
    content: str | None
    degradations: list[str]
    resolvedSkills: list[ResolvedSkillResponse]


class UpdateAgentRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    skills: list[str] | None = None
    mcps: list[str] | None = None


__all__ = [
    "AgentSummaryResponse",
    "AgentsPageResponse",
    "CompileAgentRequest",
    "CompileAgentResponse",
    "ResolvedSkillResponse",
    "UpdateAgentRequest",
]

