import type { McpInstallConfigFieldDto } from "../api/mcp-types";
import type { McpInstallConfigValues } from "./mcp-install-action";

export type InstallConfigFormValues = Record<string, string | boolean>;

export function buildInitialInstallConfigValues(
  fields: readonly McpInstallConfigFieldDto[],
): InstallConfigFormValues {
  const initial: InstallConfigFormValues = {};
  for (const field of fields) {
    if (field.format === "boolean") {
      initial[field.name] = field.default === "true";
    } else {
      initial[field.name] = field.default || "";
    }
  }
  return initial;
}

export function missingRequiredInstallConfigFields(
  fields: readonly McpInstallConfigFieldDto[],
  values: InstallConfigFormValues,
): string[] {
  return fields
    .filter((field) => field.required && isEmptyInstallConfigValue(values[field.name]))
    .map((field) => field.name);
}

export function buildInstallConfigPayload(
  fields: readonly McpInstallConfigFieldDto[],
  values: InstallConfigFormValues,
): McpInstallConfigValues {
  const config: McpInstallConfigValues = {};
  for (const field of fields) {
    const value = values[field.name];
    if (isEmptyInstallConfigValue(value)) {
      continue;
    }
    config[field.name] = field.format === "number" ? Number(value) : value;
  }
  return config;
}

export function isEmptyInstallConfigValue(value: string | boolean | undefined): boolean {
  return value === undefined || value === "";
}
