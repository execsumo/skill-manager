import { describe, expect, it } from "vitest";
import type {
  PermissionInventoryEntryDto,
  PermissionInventoryColumnDto,
} from "../api/management-types";
import { matrixCellFor } from "./selectors";

describe("permissions selectors", () => {
  const column: PermissionInventoryColumnDto = {
    harness: "antigravity-permissions",
    label: "Antigravity",
    installed: true,
    configPresent: true,
    permissionsWritable: true,
  };

  it("appends caveat to tooltip for enabled permissions when caveat exists", () => {
    const entry: PermissionInventoryEntryDto = {
      id: "my-permission",
      displayName: "My Permission",
      kind: "managed",
      canEnable: true,
      enabledStatus: "enabled",
      sightings: [
        {
          harness: "antigravity-permissions",
          state: "managed",
          caveat: "On Antigravity this maps to PreInvocation, which fires before every model invocation, not only on user-prompt submit.",
        },
      ],
    };

    const cell = matrixCellFor(entry, column);
    expect(cell.state).toBe("enabled");
    expect(cell.tooltip).toBe(
      "Enabled on Antigravity (Caveat: On Antigravity this maps to PreInvocation, which fires before every model invocation, not only on user-prompt submit.)"
    );
  });

  it("appends caveat to tooltip for disabled/missing permissions when caveat exists", () => {
    const entry: PermissionInventoryEntryDto = {
      id: "my-permission",
      displayName: "My Permission",
      kind: "managed",
      canEnable: true,
      enabledStatus: "disabled",
      sightings: [
        {
          harness: "antigravity-permissions",
          state: "missing",
          caveat: "On Antigravity this maps to PreInvocation, which fires before every model invocation, not only on user-prompt submit.",
        },
      ],
    };

    const cell = matrixCellFor(entry, column);
    expect(cell.state).toBe("disabled");
    expect(cell.tooltip).toBe(
      "Disabled on Antigravity (Caveat: On Antigravity this maps to PreInvocation, which fires before every model invocation, not only on user-prompt submit.)"
    );
  });

  it("does not append caveat when caveat is absent", () => {
    const entry: PermissionInventoryEntryDto = {
      id: "my-permission",
      displayName: "My Permission",
      kind: "managed",
      canEnable: true,
      enabledStatus: "enabled",
      sightings: [
        {
          harness: "antigravity-permissions",
          state: "managed",
        },
      ],
    };

    const cell = matrixCellFor(entry, column);
    expect(cell.state).toBe("enabled");
    expect(cell.tooltip).toBe("Enabled on Antigravity");
  });
});
