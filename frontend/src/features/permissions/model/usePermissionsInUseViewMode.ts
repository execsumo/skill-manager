import { usePersistentViewMode } from "../../../lib/usePersistentViewMode";

export type PermissionsInUseViewMode = "cards" | "matrix";

const STORAGE_KEY = "skillmgr.permissions.inUse.view";

function isValidMode(value: unknown): value is PermissionsInUseViewMode {
  return value === "cards" || value === "matrix";
}

export function usePermissionsInUseViewMode(): [PermissionsInUseViewMode, (next: PermissionsInUseViewMode) => void] {
  return usePersistentViewMode<PermissionsInUseViewMode>({
    storageKey: STORAGE_KEY,
    defaultMode: "cards",
    isValidMode,
  });
}
