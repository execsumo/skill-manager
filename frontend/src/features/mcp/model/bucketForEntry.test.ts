import { describe, expect, it } from "vitest";

import type { McpInventoryColumnDto, McpInventoryEntryDto } from "../api/management-types";
import { bucketForMcpEntry, bucketMcpEntries } from "./bucketForEntry";

const columns: McpInventoryColumnDto[] = [
  { harness: "h0", label: "H0", logoKey: null, installed: true, configPresent: true, mcpWritable: true },
  { harness: "h1", label: "H1", logoKey: null, installed: true, configPresent: true, mcpWritable: true },
];

function entry(name: string, states: ("managed" | "drifted" | "missing")[]): McpInventoryEntryDto {
  return {
    name,
    displayName: name,
    kind: "managed",
    canEnable: true,
    enabledStatus: states.some((s) => s === "managed") ? "enabled" : "disabled",
    availabilityStatus: "unavailable",
    availabilityReason: null,
    mcpStatus: { kind: "unchecked", reason: null },
    installConfigStatus: { hasFields: false, missingRequired: [], configured: true },
    spec: null,
    sightings: states.map((state, i) => ({ harness: `h${i}`, state })),
  } as McpInventoryEntryDto;
}

describe("bucketForMcpEntry", () => {
  it("classifies all-managed as 'enabled'", () => {
    expect(bucketForMcpEntry(entry("a", ["managed", "managed"]), columns)).toBe("enabled");
  });

  it("classifies none-managed as 'disabled'", () => {
    expect(bucketForMcpEntry(entry("a", ["missing", "missing"]), columns)).toBe("disabled");
  });

  it("classifies mixed as 'selective'", () => {
    expect(bucketForMcpEntry(entry("a", ["managed", "missing"]), columns)).toBe("selective");
  });

  it("treats entries with no addressable harnesses as 'disabled'", () => {
    expect(bucketForMcpEntry(entry("a", []), [])).toBe("disabled");
  });
});

describe("bucketMcpEntries", () => {
  it("partitions entries into three buckets preserving order", () => {
    const a = entry("a", ["missing", "missing"]);
    const b = entry("b", ["managed", "missing"]);
    const c = entry("c", ["managed", "managed"]);
    const result = bucketMcpEntries([a, b, c], columns);
    expect(result.disabled.map((e) => e.name)).toEqual(["a"]);
    expect(result.selective.map((e) => e.name)).toEqual(["b"]);
    expect(result.enabled.map((e) => e.name)).toEqual(["c"]);
  });
});
