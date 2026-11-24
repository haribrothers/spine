import { describe, expect, it } from "vitest";
import { ALL_MODULE_KEYS, MODULE_KEYS, isOn, moduleForRoute, moduleOffMessage, moduleSettingsSchema, resolveModules } from "./modules.ts";
import { aiProviderHost, aiProviderReady, isLocalAddress, maskedKey } from "./schemas/ai.ts";

describe("US-AI-01", () => {
  it("the AI assistant is the fifth module, but not one of the Modules switches", () => {
    // US-MCP-02: connected agents (sixth) come after it.
    expect(ALL_MODULE_KEYS).toEqual([...MODULE_KEYS, "ai", "agents"]);
    expect(moduleSettingsSchema.safeParse({ leadsMeetings: true, jobsField: true, approvals: true, recurring: true, ai: true }).success).toBe(false);
  });

  it("owns the /ai routes, not Settings › AI assistant", () => {
    expect(moduleForRoute("/ai/read-document")).toBe("ai");
    expect(moduleForRoute("/ai/status?x=1")).toBe("ai");
    expect(moduleForRoute("/org/ai")).toBeNull();
    expect(moduleForRoute("/org/ai/test")).toBeNull();
  });

  it("is off unless switched on, and says where to switch it on", () => {
    const modules = resolveModules(null);
    expect(isOn(modules, "ai")).toBe(false);
    expect(isOn({ ...modules, ai: true }, "ai")).toBe(true);
    expect(isOn(modules, "jobsField")).toBe(true);
    expect(moduleOffMessage("ai")).toBe("The AI assistant is off. An owner can switch it on in Settings › AI assistant.");
  });

  it("tells the business's own network from anywhere else (D-164)", () => {
    for (const url of ["http://localhost:11434/v1", "http://127.0.0.1:1234/v1", "http://192.168.1.20:11434/v1", "http://10.0.0.5/v1", "http://172.20.1.1/v1", "http://ollama:11434/v1", "http://llm.local/v1", "http://[::1]:8000/v1", "http://[fd12:3456::1]/v1"]) {
      expect(isLocalAddress(url), url).toBe(true);
    }
    for (const url of ["https://api.openai.com/v1", "https://llm.example.com/v1", "http://172.32.0.1/v1", "http://8.8.8.8/v1", "not a url", null]) {
      expect(isLocalAddress(url), String(url)).toBe(false);
    }
  });

  it("knows when a provider is complete enough to switch on", () => {
    expect(aiProviderReady({ driver: "none", baseUrl: null, model: null, apiKeyHint: null })).toBe(false);
    expect(aiProviderReady({ driver: "openai-compatible", baseUrl: "http://192.168.1.20:11434/v1", model: null, apiKeyHint: null })).toBe(false);
    expect(aiProviderReady({ driver: "openai-compatible", baseUrl: "http://192.168.1.20:11434/v1", model: "qwen2.5:14b", apiKeyHint: null })).toBe(true);
    expect(aiProviderReady({ driver: "anthropic", baseUrl: null, model: "claude-sonnet-5-5", apiKeyHint: null })).toBe(false);
    expect(aiProviderReady({ driver: "anthropic", baseUrl: null, model: "claude-sonnet-5-5", apiKeyHint: "1a2b" })).toBe(true);
  });
});

describe("US-AI-02", () => {
  it("names where requests go and masks the key", () => {
    expect(aiProviderHost("anthropic", null)).toBe("api.anthropic.com");
    expect(aiProviderHost("openai-compatible", "http://192.168.1.20:11434/v1")).toBe("192.168.1.20:11434");
    expect(aiProviderHost("none", "http://x")).toBeNull();
    expect(maskedKey("1a2b")).toBe("••••1a2b");
    expect(maskedKey(null)).toBe("");
  });
});
