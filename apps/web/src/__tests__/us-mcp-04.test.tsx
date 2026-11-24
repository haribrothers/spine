import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ownedByOffModule, resolveModules, type AgentConnection, type AgentsSettings, type MyAgentConnections } from "@spine/shared";

const state = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), del: vi.fn(), toast: vi.fn(), refresh: vi.fn() }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get, put: state.put, delete: state.del } }));
vi.mock("../components/toast-host", () => ({ useToast: () => state.toast }));
vi.mock("../lib/modules-context", () => ({ useModules: () => ({ modules: null, refresh: state.refresh }) }));

import { MyAgentsPane } from "../app/settings/panes/my-agents-pane";
import { AgentsPane } from "../app/settings/panes/agents-pane";
import { SETTINGS_SECTIONS } from "../components/settings-dialog";

const now = new Date().toISOString();
const chatgpt: AgentConnection = { id: "c1", clientName: "ChatGPT", clientHost: "chatgpt.com", verified: true, scopes: ["spine:read"], connectedAt: "2026-10-14T09:00:00.000Z", lastUsedAt: now };
const helper: AgentConnection = { id: "c2", clientName: "Site Notes Helper", clientHost: "agent.example.net", verified: false, scopes: ["spine:read", "spine:draft"], connectedAt: "2026-10-09T09:00:00.000Z", lastUsedAt: null, user: { id: "u-marcus", name: "Marcus Webb", role: "field" } };

beforeEach(() => {
  for (const fn of Object.values(state)) fn.mockReset();
});

describe("US-MCP-04 · Settings › Your account › Connected agents", () => {
  it("is in Your account for everyone, and gone while Connected agents is off", () => {
    const pane = SETTINGS_SECTIONS.find((s) => s.key === "my-connected-agents")!;
    expect(pane).toMatchObject({ group: "account", label: "Connected agents" });
    expect(ownedByOffModule(resolveModules(null), "settingsPanes", "my-connected-agents")).toBe(true);
    expect(ownedByOffModule({ ...resolveModules(null), agents: true }, "settingsPanes", "my-connected-agents")).toBe(false);
  });

  it("lists the person's agents — host, what each may do, connected and last used — and the address to connect another", async () => {
    state.get.mockResolvedValue({ mcpUrl: "https://spine.example.com/api/mcp", connections: [chatgpt] } satisfies MyAgentConnections);
    render(<MyAgentsPane />);
    const row = (await screen.findAllByTestId("agent-connection"))[0]!;
    expect(row.textContent).toContain("ChatGPT");
    expect(row.textContent).toContain("chatgpt.com");
    expect(row.textContent).toContain("Read");
    expect(row.textContent).toContain("Just now");
    expect(screen.getByText("Connect another agent")).toBeTruthy();
    expect(screen.getByTestId("connector-address").textContent).toContain("https://spine.example.com/api/mcp");
  });

  it("Disconnect asks first, then says so and reloads the list", async () => {
    state.get.mockResolvedValueOnce({ mcpUrl: "x", connections: [chatgpt] }).mockResolvedValueOnce({ mcpUrl: "x", connections: [] });
    state.del.mockResolvedValue(undefined);
    render(<MyAgentsPane />);
    fireEvent.click(await screen.findByRole("button", { name: "Disconnect ChatGPT" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Disconnect ChatGPT?")).toBeTruthy();
    expect(dialog.textContent).toContain("It stops working at once. Drafts it created stay, marked with its name.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(state.del).toHaveBeenCalledWith("/agents/connections/c1"));
    expect(state.toast).toHaveBeenCalledWith("ChatGPT disconnected", expect.any(String));
    expect(await screen.findByText("No agents connected")).toBeTruthy();
  });
});

describe("US-MCP-04 · the Owner's Connections", () => {
  it("lists everyone's agents with whose they are, marks unverified names, and disconnects anyone's after asking", async () => {
    const settings: AgentsSettings = { enabled: true, drafts: true, mcpUrl: "https://spine.example.com/api/mcp", httpsReachable: true };
    state.get.mockImplementation(async (path: string) => (path === "/org/agents" ? settings : [helper]));
    state.del.mockResolvedValue(undefined);
    render(<AgentsPane />);
    const row = (await screen.findAllByTestId("agent-connection"))[0]!;
    expect(row.textContent).toContain("Marcus Webb");
    expect(row.textContent).toContain("Field");
    expect(row.textContent).toContain("Unverified name");
    expect(row.textContent).toContain("Read and add job notes");
    expect(row.textContent).toContain("Not used yet");
    fireEvent.click(within(row).getByRole("button", { name: "Disconnect Site Notes Helper (Marcus Webb)" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Marcus Webb is told.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(state.del).toHaveBeenCalledWith("/org/agents/connections/c2"));
    expect(state.toast).toHaveBeenCalledWith("Site Notes Helper disconnected", "Marcus Webb is told it was disconnected.");
  });
});
