import type { QueryClient } from "@tanstack/react-query";
import { agentsKeys } from "./keys";

export async function invalidateAgentsQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: agentsKeys.all });
}
