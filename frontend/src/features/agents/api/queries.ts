import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryPolicy } from "../../../lib/query";
import { fetchAgents, compileAgent, scaffoldAgent, updateAgent } from "./client";
import { agentsKeys } from "./keys";
import { invalidateAgentsQueries } from "./invalidation";
import type { CompileAgentRequest, ScaffoldRequest, UpdateAgentRequest } from "./types";

export function useAgentsQuery() {
  return useQuery({
    queryKey: agentsKeys.list(),
    queryFn: fetchAgents,
    ...queryPolicy(5000, 300000), // Standard 5s stale, 5m gc
  });
}

export function useCompileAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentRef, request }: { agentRef: string; request: CompileAgentRequest }) =>
      compileAgent(agentRef, request),
    onSettled: () => invalidateAgentsQueries(queryClient),
  });
}

export function useScaffoldAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: ScaffoldRequest) => scaffoldAgent(request),
    onSettled: () => invalidateAgentsQueries(queryClient),
  });
}

export function useUpdateAgentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentRef, request }: { agentRef: string; request: UpdateAgentRequest }) =>
      updateAgent(agentRef, request),
    onSettled: () => invalidateAgentsQueries(queryClient),
  });
}


