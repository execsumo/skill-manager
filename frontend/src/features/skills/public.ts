export {
  useDeleteSkillMutation,
  useManageAllSkillsMutation,
  useManageSkillMutation,
  useSetSkillHarnessesMutation,
  useSkillDetailQuery,
  useSkillsListQuery,
  useSkillSourceStatusQuery,
  useToggleSkillMutation,
  useUnmanageSkillMutation,
  useUpdateSkillMutation,
} from "./api/queries";
export { invalidateSkillsQueries } from "./api/invalidation";
export { skillsKeys } from "./api/keys";
export type {
  HarnessCell,
  HarnessColumn,
  SkillListRow,
  SkillsWorkspaceData,
} from "./model/types";

// Scan-config credential management is surfaced through the Settings page, but
// the shared store, client, modal, and `scan.css` remain part of the skills
// feature (the scan view lives here). Settings consumes them via this public
// API so cross-feature imports stay on the sanctioned feature barrel instead
// of reaching into `skills/api` (which the import-boundary test forbids).
export { useSkillScan } from "./model/use-skill-scan";
export type { LLMScanConfig, LLMScanConfigInput } from "./model/use-skill-scan";
export { ScanConfigDetailModal } from "./components/scan/ScanConfigDetailModal";
export type {
  ScanConfigItem,
  ScanConfigListResponse,
  ScanConfigSavePayload,
  ScanConfigValidatePayload,
  ScanConfigValidationResponse,
  ScanConfigSecretResponse,
} from "./api/scan-types";

export const skillsRoutes = {
  inUse: "/skills/use",
  needsReview: "/skills/review",
  marketplace: "/marketplace/skills",
} as const;
