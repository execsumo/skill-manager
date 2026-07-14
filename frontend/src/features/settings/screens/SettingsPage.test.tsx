import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import SettingsPage from "./SettingsPage";

const fetchMock = vi.fn();

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders backend-provided local storage paths", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/settings") {
        return okJson({
          storage: {
            platform: "linux",
            configDir: "/tmp/config/skill-manager",
            dataDir: "/tmp/data/skill-manager",
            stateDir: "/tmp/state/skill-manager",
            skillsStorePath: "/tmp/data/skill-manager/shared",
            marketplaceCachePath: "/tmp/data/skill-manager/marketplace",
            settingsPath: "/tmp/config/skill-manager/settings.json",
          },
          harnesses: [],
        });
      }
      if (url === "/api/scan/configs") {
        return okJson({ activeId: null, configs: [] });
      }
      throw new Error(`Unhandled URL ${url}`);
    });

    renderWithAppProviders(<SettingsPage />);

    expect(await screen.findByText("/tmp/data/skill-manager/shared")).toBeInTheDocument();
    expect(screen.getByText("/tmp/data/skill-manager/marketplace")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Scan Config" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New configuration" })).toBeInTheDocument();
  });
});
