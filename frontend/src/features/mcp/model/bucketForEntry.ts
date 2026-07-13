import type { McpInventoryColumnDto, McpInventoryEntryDto } from "../api/management-types";
import { matrixCoverage } from "./selectors";

export type McpBucket = "disabled" | "selective" | "enabled";

export function bucketForMcpEntry(
  entry: McpInventoryEntryDto,
  columns: readonly McpInventoryColumnDto[],
): McpBucket {
  const { enabled, writable } = matrixCoverage(entry, columns);
  if (writable === 0 || enabled === 0) return "disabled";
  if (enabled === writable) return "enabled";
  return "selective";
}

export interface McpEntryBuckets {
  disabled: McpInventoryEntryDto[];
  selective: McpInventoryEntryDto[];
  enabled: McpInventoryEntryDto[];
}

export function bucketMcpEntries(
  entries: readonly McpInventoryEntryDto[],
  columns: readonly McpInventoryColumnDto[],
): McpEntryBuckets {
  const result: McpEntryBuckets = { disabled: [], selective: [], enabled: [] };
  for (const entry of entries) {
    result[bucketForMcpEntry(entry, columns)].push(entry);
  }
  return result;
}
