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
        ref: "agent1",
        slug: "agent1",
        name: "Test Agent 1",
        description: "A cool agent",
        skills: ["skill1", "skill2"],
        mcps: ["mcp1"],
        compileTargets: ["cursor", "codex"],
        toolsAllowed: [],
        toolsDenied: [],
      },
      {
        ref: "agent2",
        slug: "agent2",
        name: "Test Agent 2",
        description: "",
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
    expect(screen.getByText(/Connected Skills \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Connected MCPs \(1\)/i)).toBeInTheDocument();
  });

  it("opens hire dialog when clicking Hire Agent button", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/agents/agent1/compile")) {
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
    
    // click Hire Agent button on card
    const hireButtons = screen.getAllByRole("button", { name: "Hire Agent" });
    fireEvent.click(hireButtons[0]);
    
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
    const dialogHireBtn = screen.getByRole("button", { name: "Hire Agent" });
    fireEvent.click(dialogHireBtn);
    
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Hire Agent: Test Agent 1" })).not.toBeInTheDocument();
    });
  });

  it("opens create agent dialog and scaffolds new agent", async () => {
    let scaffoldCalled = false;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/scaffold")) {
        scaffoldCalled = true;
        const body = JSON.parse(String(init?.body));
        expect(body).toEqual({
          asset_type: "agent",
          name: "New Security Agent",
          description: "Scans for vulnerability",
          skills: [],
          mcps: [],
        });
        return okJson({ file_path: "/path/to/new-security-agent.md" });
      }
      if (url.includes("/api/agents")) return okJson(agentsFixture());
      if (url.includes("/api/skills")) return okJson({ rows: [] });
      if (url.includes("/api/mcp/inventory")) return okJson({ servers: [] });
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Test Agent 1")).toBeInTheDocument());

    const newBtn = screen.getByRole("button", { name: "New Agent" });
    fireEvent.click(newBtn);

    const dialogTitle = await screen.findByRole("heading", { name: "Create New Agent Persona" });
    expect(dialogTitle).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("e.g. Code Reviewer"), {
      target: { value: "New Security Agent" },
    });
    fireEvent.change(screen.getByPlaceholderText("Describe the agent's purpose and capabilities..."), {
      target: { value: "Scans for vulnerability" },
    });

    const submitBtn = screen.getByRole("button", { name: "Create Agent" });
    fireEvent.click(submitBtn);

    await waitFor(() => expect(scaffoldCalled).toBe(true));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Create New Agent Persona" })).not.toBeInTheDocument();
    });
  });

  it("opens edit dialog and updates agent capabilities", async () => {
    let updateCalled = false;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/agents/agent1")) {
        updateCalled = true;
        const body = JSON.parse(String(init?.body));
        expect(body).toEqual({
          name: "Updated Agent 1",
          description: "Updated desc",
          skills: ["skill1", "skill2"],
          mcps: ["mcp1"],
        });
        return okJson({
          ...agentsFixture().agents[0],
          name: "Updated Agent 1",
          description: "Updated desc",
        });
      }
      if (url.includes("/api/agents")) return okJson(agentsFixture());
      if (url.includes("/api/skills")) return okJson({ rows: [] });
      if (url.includes("/api/mcp/inventory")) return okJson({ servers: [] });
      throw new Error(`Unhandled URL ${url}`);
    });

    renderPage();
    await waitFor(() => expect(screen.getByText("Test Agent 1")).toBeInTheDocument());

    const editBtns = screen.getAllByRole("button", { name: "Edit" });
    fireEvent.click(editBtns[0]);

    const dialogTitle = await screen.findByRole("heading", { name: "Manage Agent Capabilities: Test Agent 1" });
    expect(dialogTitle).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Test Agent 1"), {
      target: { value: "Updated Agent 1" },
    });
    fireEvent.change(screen.getByDisplayValue("A cool agent"), {
      target: { value: "Updated desc" },
    });

    const saveBtn = screen.getByRole("button", { name: "Save Capabilities" });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(updateCalled).toBe(true));
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Manage Agent Capabilities: Test Agent 1" })).not.toBeInTheDocument();
    });
  });
});


