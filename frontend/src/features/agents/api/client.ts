import { fetchJson, postJson, putJson } from "../../../api/http";
import type { AgentsPageResponse, AgentSummaryResponse, CompileAgentRequest, CompileAgentResponse, ScaffoldRequest, ScaffoldResponse, UpdateAgentRequest } from "./types";

export async function fetchAgents(): Promise<AgentsPageResponse> {
  return fetchJson<AgentsPageResponse>("/agents");
}

export async function compileAgent(agentRef: string, request: CompileAgentRequest): Promise<CompileAgentResponse> {
  return postJson<CompileAgentResponse>(`/agents/${encodeURIComponent(agentRef)}/compile`, request);
}

export async function scaffoldAgent(request: ScaffoldRequest): Promise<ScaffoldResponse> {
  return postJson<ScaffoldResponse>("/scaffold", request);
}

export async function updateAgent(agentRef: string, request: UpdateAgentRequest): Promise<AgentSummaryResponse> {
  return putJson<AgentSummaryResponse>(`/agents/${encodeURIComponent(agentRef)}`, request);
}


