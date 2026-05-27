import type { McpInventoryEntryDto } from "../api/management-types";
import { useMcpCopy } from "../i18n";

type AvailabilityStatus = McpInventoryEntryDto["availabilityStatus"];

interface McpAvailabilityStatusChipProps {
  status: AvailabilityStatus;
  reason?: string | null;
}

export function McpAvailabilityStatusChip({
  status,
  reason,
}: McpAvailabilityStatusChipProps) {
  const copy = useMcpCopy();
  const label = copy.detail.availabilityStatus[status];

  return (
    <span
      className="chip mcp-availability-status-chip"
      data-status={status}
      aria-label={copy.detail.availabilityStatusAria(label)}
      title={reason ?? undefined}
    >
      <span className="mcp-availability-status-chip__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
