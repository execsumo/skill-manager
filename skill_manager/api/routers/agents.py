from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from skill_manager.api.deps import get_container
from skill_manager.api.schemas.agents import (
    AgentsPageResponse,
    AgentSummaryResponse,
    CompileAgentRequest,
    CompileAgentResponse,
    ResolvedSkillResponse,
    UpdateAgentRequest,
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


@router.put("/{agent_ref:path}", response_model=AgentSummaryResponse)
def update_agent(
    agent_ref: str,
    body: UpdateAgentRequest,
    container: BackendContainer = Depends(get_container),
) -> AgentSummaryResponse:
    try:
        updated = container.agents_service.save_agent(
            agent_ref,
            name=body.name,
            description=body.description,
            skills=body.skills,
            mcps=body.mcps,
        )
        container.invalidation.invalidate_all()
        return AgentSummaryResponse(
            ref=updated.ref,
            slug=updated.slug,
            name=updated.name,
            description=updated.description,
            skills=list(updated.skills),
            mcps=list(updated.mcps),
            toolsAllowed=list(updated.tools_allowed),
            toolsDenied=list(updated.tools_denied),
            compileTargets=[t for t in COMPILE_TARGETS],
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error))


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
        artifact = container.agents_service.compile(
            agent,
            body.harness,
            project_dir=Path(body.project_dir) if body.project_dir else None,
        )
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

