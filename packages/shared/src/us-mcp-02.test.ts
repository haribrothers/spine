import { describe, expect, it } from "vitest";
import { ALL_MODULE_KEYS, MODULE_KEYS, agentsAddressReachable, agentsSettingsUpdateSchema, isOn, moduleForRoute, moduleOffMessage, moduleSettingsSchema, ownedByOffModule, resolveModules } from "./index.ts";

describe("US-MCP-02 · connected agents are the sixth module", () => {
  it("comes after the AI assistant, isn't one of the Modules switches, and is off unless switched on", () => {
    expect(ALL_MODULE_KEYS.slice(MODULE_KEYS.length)).toEqual(["ai", "agents"]);
    expect(moduleSettingsSchema.safeParse({ ...resolveModules(null), agents: true }).success).toBe(false);
    expect(isOn(resolveModules(null), "agents")).toBe(false);
    expect(isOn({ ...resolveModules(null), agents: true }, "agents")).toBe(true);
  });

  it("owns /mcp and /agents (refused while off), not Settings › Connected agents", () => {
    expect(moduleForRoute("/mcp")).toBe("agents");
    expect(moduleForRoute("/agents/connections/abc")).toBe("agents");
    expect(moduleForRoute("/org/agents")).toBeNull();
    expect(moduleOffMessage("agents")).toBe("Connected agents are off. An owner can switch them on in Settings › Connected agents.");
    expect(ownedByOffModule(resolveModules(null), "settingsPanes", "my-connected-agents")).toBe(true);
  });

  it("knows when no agent can sign in at the address (http only on localhost)", () => {
    expect(agentsAddressReachable("https://spine.example.com/api/mcp")).toBe(true);
    expect(agentsAddressReachable("http://localhost:4000/mcp")).toBe(true);
    expect(agentsAddressReachable("http://127.0.0.1:4000/mcp")).toBe(true);
    expect(agentsAddressReachable("http://192.168.1.10/api/mcp")).toBe(false);
    expect(agentsAddressReachable("http://spine.example.com/api/mcp")).toBe(false);
    expect(agentsAddressReachable("not a url")).toBe(false);
  });

  it("an update changes the switch, drafts or both — never nothing", () => {
    expect(agentsSettingsUpdateSchema.safeParse({ enabled: true }).success).toBe(true);
    expect(agentsSettingsUpdateSchema.safeParse({ drafts: false }).success).toBe(true);
    expect(agentsSettingsUpdateSchema.safeParse({}).success).toBe(false);
    expect(agentsSettingsUpdateSchema.safeParse({ enabled: true, extra: 1 }).success).toBe(false);
  });
});
