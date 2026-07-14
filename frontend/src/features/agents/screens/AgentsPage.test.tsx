import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { okJson, errorJson } from "../../../test/fetch";
import { renderWithAppProviders } from "../../../test/render";
import type { AgentsPageResponse } from "../api/types";
import AgentsPage from "./AgentsPage";

const fetchMock = vi.fn();
let storage: Map<string, string>;

function agentsFixture(): AgentsPageResponse {
  return {
    issues: ["Issue 1", "Issue 2"],
    agents: [
      {
        ref: "pkg:agent1",
        slug: "agent1",
        name: "Test Agent 1",
        description: "A cool agent",
        packageSlug: "pkg",
        skills: ["skill1", "skill2"],
        mcps: ["mcp1"],
        compileTargets: ["cursor", "codex"],
        toolsAllowed: [],
        toolsDenied: [],
      },
      {
        ref: "pkg:agent2",
        slug: "agent2",
        name: "Test Agent 2",
        description: "",
        packageSlug: "pkg",
        skills: [],
        mcps: [],
        compileTargets: ["codex"],
        toolsAllowed: [],
        toolsDenied: [],
      },
    ],
  };
}

function renderPage(route = "/agents") {
  return renderWithAppProviders(<AgentsPage />, { route });
}

describe("AgentsPage", () => {
  beforeEach(() => {
    storage = new Map();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storage.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          storage.set(key, value);
        }),
        removeItem: vi.fn((key: string) => {
          storage.delete(key);
        }),
      },
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("renders empty state", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/agents")) return okJson({ issues: [], agents: [] });
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("No Agents Found")).toBeInTheDocument());
    expect(screen.getByText(/Agents live in/i)).toBeInTheDocument();
  });

  it("renders agents and issues", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/agents")) return okJson(agentsFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Test Agent 1")).toBeInTheDocument());
    expect(screen.getByText("Test Agent 2")).toBeInTheDocument();
    
    // issues
    expect(screen.getByText("Issue 1")).toBeInTheDocument();
    expect(screen.getByText("Issue 2")).toBeInTheDocument();

    // metadata
    expect(screen.getByText("2 skills")).toBeInTheDocument();
    expect(screen.getByText("1 MCPs")).toBeInTheDocument();
  });

  it("opens hire dialog and interacts with preview", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/agents/pkg%3Aagent1/compile")) {
        const body = JSON.parse(String(init?.body));
        if (body.dryRun) {
          return okJson({
            ok: true,
            targetPath: "/some/path",
            content: "preview content",
            degradations: ["Degradation A"],
            resolvedSkills: [{ alias: "skill1", revision: "hash123" }],
          });
        }
        return okJson({ ok: true, targetPath: "/success/path" });
      }
      if (url.includes("/api/agents")) return okJson(agentsFixture());
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Test Agent 1")).toBeInTheDocument());
    
    // click card to open hire dialog
    fireEvent.click(screen.getByText("Test Agent 1"));
    
    // waiting for dialog
    const dialogTitle = await screen.findByRole("heading", { name: "Hire Agent: Test Agent 1" });
    expect(dialogTitle).toBeInTheDocument();

    // since first target is cursor, preview is disabled without projectDir
    const previewBtn = screen.getByRole("button", { name: "Preview" });
    expect(previewBtn).toBeDisabled();

    // enter projectDir
    fireEvent.change(screen.getByPlaceholderText("/Users/hgill/projects/my-app"), { target: { value: "/my/dir" } });
    expect(previewBtn).not.toBeDisabled();

    // click preview
    fireEvent.click(previewBtn);
    
    // wait for preview result
    await waitFor(() => expect(screen.getByText("preview content")).toBeInTheDocument());
    expect(screen.getByText("Degradation A")).toBeInTheDocument();
    expect(screen.getByText("skill1 @ hash123")).toBeInTheDocument();

    // hire
    const hireBtn = screen.getByRole("button", { name: "Hire Agent" });
    fireEvent.click(hireBtn);
    
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Hire Agent: Test Agent 1" })).not.toBeInTheDocument();
    });
  });
});
