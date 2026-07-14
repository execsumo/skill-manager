from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from skill_manager.api.deps import get_container
from skill_manager.api.schemas.agents import (
    AgentsPageResponse,
    AgentSummaryResponse,
    CompileAgentRequest,
    CompileAgentResponse,
    ResolvedSkillResponse,
)
from skill_manager.application import BackendContainer
from skill_manager.application.agents import COMPILE_TARGETS, AgentCompileError

router = APIRouter(prefix="/api/agents", tags=["Agents"])


@router.get("", response_model=AgentsPageResponse)
def list_agents(container: BackendContainer = Depends(get_container)) -> AgentsPageResponse:
    agents, issues = container.agents_service.scan()
    return AgentsPageResponse(
        agents=[
            AgentSummaryResponse(
                ref=agent.ref,
                slug=agent.slug,
                name=agent.name,
                description=agent.description,
                packageSlug=agent.package_slug,
                skills=list(agent.skills),
                mcps=list(agent.mcps),
                toolsAllowed=list(agent.tools_allowed),
                toolsDenied=list(agent.tools_denied),
                compileTargets=[t for t in COMPILE_TARGETS],
            )
            for agent in agents
        ],
        issues=list(issues),
    )


@router.post("/{agent_ref:path}/compile", response_model=CompileAgentResponse)
def compile_agent(
    agent_ref: str,
    body: CompileAgentRequest,
    container: BackendContainer = Depends(get_container),
) -> CompileAgentResponse:
    agent = container.agents_service.get(agent_ref)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"unknown agent ref: {agent_ref}")
    try:
        artifact = container.agents_service.compile(agent, body.harness)
        written = False
        if not body.dry_run:
            container.agents_service.write_artifact(artifact)
            written = True
    except AgentCompileError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return CompileAgentResponse(
        ok=True,
        agentRef=artifact.agent_ref,
        harness=artifact.harness,
        targetPath=str(artifact.target_path),
        written=written,
        content=artifact.content if body.dry_run else None,
        degradations=list(artifact.degradations),
        resolvedSkills=[
            ResolvedSkillResponse(alias=s.alias, name=s.declared_name, revision=s.revision)
            for s in artifact.resolved_skills
        ],
    )
