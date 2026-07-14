import { fetchJson, postJson } from "../../../api/http";
import type { AgentsPageResponse, CompileAgentRequest, CompileAgentResponse } from "./types";

export async function fetchAgents(): Promise<AgentsPageResponse> {
  return fetchJson<AgentsPageResponse>("/agents");
}

export async function compileAgent(agentRef: string, request: CompileAgentRequest): Promise<CompileAgentResponse> {
  return postJson<CompileAgentResponse>(`/agents/${encodeURIComponent(agentRef)}/compile`, request);
}
