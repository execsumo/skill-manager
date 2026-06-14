import type { PermissionInventoryColumnDto, PermissionInventoryEntryDto } from "../api/management-types";
import { PermissionCard } from "./PermissionCard";

interface PermissionCardListProps {
  entries: PermissionInventoryEntryDto[];
  columns: PermissionInventoryColumnDto[];
  pendingPermissionKeys: ReadonlySet<string>;
  checkedIds: ReadonlySet<string>;
  onOpenDetail: (id: string) => void;
  onToggleChecked: (id: string) => void;
  onSetHarnesses: (id: string, target: "enabled" | "disabled") => void;
  onRequestUninstall: (id: string) => void;
  ariaLabel?: string;
}

export function PermissionCardList({
  entries,
  columns,
  pendingPermissionKeys,
  checkedIds,
  onOpenDetail,
  onToggleChecked,
  onSetHarnesses,
  onRequestUninstall,
  ariaLabel,
}: PermissionCardListProps) {
  return (
    <section className="skill-grid" aria-label={ariaLabel ?? "Permissions list"}>
      {entries.map((entry) => (
        <PermissionCard
          key={entry.id}
          entry={entry}
          columns={columns}
          pending={pendingPermissionKeys.has(entry.id)}
          checked={checkedIds.has(entry.id)}
          onOpenDetail={onOpenDetail}
          onToggleChecked={onToggleChecked}
          onSetHarnesses={onSetHarnesses}
          onRequestUninstall={onRequestUninstall}
        />
      ))}
    </section>
  );
}
