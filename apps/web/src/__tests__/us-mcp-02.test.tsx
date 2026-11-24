import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MODULES, moduleForRoute, type AgentsSettings } from "@spine/shared";

const state = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), toast: vi.fn(), refresh: vi.fn() }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get, put: state.put } }));
vi.mock("../components/toast-host", () => ({ useToast: () => state.toast }));
vi.mock("../lib/modules-context", () => ({ useModules: () => ({ modules: null, refresh: state.refresh }) }));

import { AgentsPane } from "../app/settings/panes/agents-pane";
import { SETTINGS_SECTIONS } from "../components/settings-dialog";

const off: AgentsSettings = { enabled: false, drafts: true, mcpUrl: "https://spine.meridianbuilders.in/api/mcp", httpsReachable: true };
const theSwitch = () => screen.getByRole("switch", { name: "Connected agents" });

function show(saved: AgentsSettings) {
  state.get.mockResolvedValue(saved);
  render(<AgentsPane />);
  return screen.findByTestId("agents-pane");
}

beforeEach(() => {
  for (const fn of Object.values(state)) fn.mockReset();
});

describe("US-MCP-02 · Settings › Connected agents", () => {
  it("sits in the Business group after AI assistant, and settings search finds it by MCP, agent, Claude or ChatGPT", () => {
    const business = SETTINGS_SECTIONS.filter((s) => s.group === "business").map((s) => s.key);
    expect(business.slice(business.indexOf("ai"), business.indexOf("ai") + 2)).toEqual(["ai", "agents"]);
    const pane = SETTINGS_SECTIONS.find((s) => s.key === "agents")!;
    expect(pane.label).toBe("Connected agents");
    for (const word of ["MCP", "agent", "Claude", "ChatGPT"]) expect(pane.keywords.join(" ").toLowerCase()).toContain(word.toLowerCase());
  });

  it("is the sixth module: it owns /mcp and /agents, and is off until switched on", () => {
    expect(MODULES.agents.label).toBe("Connected agents");
    expect(moduleForRoute("/mcp")).toBe("agents");
    expect(moduleForRoute("/agents/connections")).toBe("agents");
    expect(moduleForRoute("/org/agents")).toBeNull();
  });

  it("starts off, says what agents can do, and shows no address until it's on", async () => {
    await show(off);
    expect(screen.getByText("Let people use Spine from AI agents like Claude and ChatGPT. Each person connects their own agent and approves what it can do. Agents can read and create drafts — they never issue, send, record or delete anything.")).toBeTruthy();
    expect(theSwitch().getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByTestId("connector-address")).toBeNull();
  });

  it("asks first — where the data goes and what agents can't do — then switches on and says so", async () => {
    await show(off);
    state.put.mockResolvedValue({ ...off, enabled: true });
    fireEvent.click(theSwitch());
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Turn on connected agents?")).toBeTruthy();
    expect(dialog.textContent).toContain("An agent sees what the person who connected it can see, and sends it to that agent's AI provider.");
    expect(dialog.textContent).toContain("They can't issue, send, record payments, approve, void, delete or change settings.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn on connected agents" }));
    await waitFor(() => expect(state.put).toHaveBeenCalledWith("/org/agents", { enabled: true }));
    expect(state.toast).toHaveBeenCalledWith("Connected agents are on", expect.any(String));
    expect(state.refresh).toHaveBeenCalled();
    expect((await screen.findByTestId("connector-address")).textContent).toContain("https://spine.meridianbuilders.in/api/mcp");
  });

  it("asks before switching off; Go back changes nothing", async () => {
    await show({ ...off, enabled: true });
    fireEvent.click(theSwitch());
    let dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Go back" }));
    expect(state.put).not.toHaveBeenCalled();
    state.put.mockResolvedValue(off);
    fireEvent.click(theSwitch());
    dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Every connected agent stops working at once. Connections are kept for when you turn this back on.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off connected agents" }));
    await waitFor(() => expect(state.put).toHaveBeenCalledWith("/org/agents", { enabled: false }));
    expect(state.toast).toHaveBeenCalledWith("Connected agents are off", expect.any(String));
  });

  it("warns that agents need https (or localhost), and offers how to connect each agent", async () => {
    await show({ ...off, enabled: true, mcpUrl: "http://192.168.1.10/api/mcp", httpsReachable: false });
    expect(screen.getByTestId("agents-http-warning").textContent).toContain("Agents can only connect to Spine over https, or from this same computer at localhost.");
    for (const agent of ["Claude", "ChatGPT", "Claude Code"]) expect(screen.getByText(agent)).toBeTruthy();
  });

  it("switches drafts without asking, and says what changed", async () => {
    await show({ ...off, enabled: true });
    state.put.mockResolvedValue({ ...off, enabled: true, drafts: false });
    fireEvent.click(screen.getByRole("switch", { name: "Agents can create drafts" }));
    await waitFor(() => expect(state.put).toHaveBeenCalledWith("/org/agents", { drafts: false }));
    expect(state.toast).toHaveBeenCalledWith("Agents can only read", expect.any(String));
  });
});
