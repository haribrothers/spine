import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI_FEATURES, DEFAULT_AI_SETTINGS, type AiSettings, type AiUsage } from "@spine/shared";

const state = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), toast: vi.fn(), refresh: vi.fn(), markSaved: vi.fn() }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get, put: state.put, post: state.post } }));
vi.mock("../components/toast-host", () => ({ useToast: () => state.toast }));
vi.mock("../lib/modules-context", () => ({ useModules: () => ({ modules: null, refresh: state.refresh }) }));
vi.mock("../lib/settings-dirty", () => ({ useSettingsSaved: () => state.markSaved }));

import { AiPane } from "../app/settings/panes/ai-pane";
import { SETTINGS_SECTIONS } from "../components/settings-dialog";

const local: AiSettings = { enabled: false, driver: "openai-compatible", baseUrl: "http://192.168.1.20:11434/v1", model: "llama3.2-vision", apiKeyHint: null, supportsImages: null, providerHost: "192.168.1.20:11434", local: true, features: { ...DEFAULT_AI_FEATURES }, monthlyTokenBudget: null };
const cloud: AiSettings = { enabled: false, driver: "anthropic", baseUrl: null, model: "claude-sonnet-5-5", apiKeyHint: "1a2b", supportsImages: true, providerHost: "api.anthropic.com", local: false, features: { ...DEFAULT_AI_FEATURES }, monthlyTokenBudget: null };

const theSwitch = () => screen.getByRole("switch", { name: "AI assistant" });

const noUsage: AiUsage = { month: "2026-10", budget: null, used: 0, requests: 0, percent: null, byFeature: [], byUser: [], pausedUntil: null };

function show(saved: AiSettings, usage: AiUsage = noUsage) {
  state.get.mockImplementation(async (path: string) => (path === "/org/ai/usage" ? usage : saved));
  render(<AiPane />);
  return screen.findByTestId("ai-pane");
}

beforeEach(() => {
  for (const fn of Object.values(state)) fn.mockReset();
});

describe("US-AI-01", () => {
  it("sits in the Business group, after Modules, and settings search finds it", () => {
    const business = SETTINGS_SECTIONS.filter((s) => s.group === "business").map((s) => s.key);
    expect(business.slice(business.indexOf("modules"), business.indexOf("modules") + 2)).toEqual(["modules", "ai"]);
    const ai = SETTINGS_SECTIONS.find((s) => s.key === "ai")!;
    expect(ai.label).toBe("AI assistant");
    for (const word of ["AI", "provider", "model", "budget", "receipts"]) expect(ai.keywords.join(" ").toLowerCase()).toContain(word.toLowerCase());
  });

  it("starts off on a new install, says what AI does, and won't switch on without a provider", async () => {
    await show(DEFAULT_AI_SETTINGS);
    expect(screen.getByText("AI helps fill in forms — reading bills and receipts, drafting emails and quote lines, suggesting bank matches. It never saves, sends or posts anything by itself.")).toBeTruthy();
    expect(theSwitch().getAttribute("aria-checked")).toBe("false");
    fireEvent.click(theSwitch());
    expect((await screen.findByRole("alert")).textContent).toBe("Connect a provider first.");
    expect(state.put).not.toHaveBeenCalled();
  });

  it("switches on with a provider on the local network without asking, and says so", async () => {
    await show(local);
    state.put.mockResolvedValue({ ...local, enabled: true });
    fireEvent.click(theSwitch());
    await waitFor(() => expect(state.put).toHaveBeenCalledWith("/org/ai", { enabled: true }));
    expect(state.toast).toHaveBeenCalledWith("AI assistant is on", expect.any(String));
    expect(state.refresh).toHaveBeenCalled();
  });

  it("asks before sending anything to a cloud provider, naming it and what each feature sends", async () => {
    await show(cloud);
    state.put.mockResolvedValue({ ...cloud, enabled: true });
    fireEvent.click(theSwitch());
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Turn on AI?")).toBeTruthy();
    expect(dialog.textContent).toContain("Business data will be sent to api.anthropic.com when people use AI features. What each feature sends is listed below.");
    expect(dialog.textContent).toContain("Never sent: bank account numbers, tax IDs and GSTINs, UPI IDs, passwords or keys.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn on AI" }));
    await waitFor(() => expect(state.put).toHaveBeenCalledWith("/org/ai", { enabled: true, acknowledged: true }));
  });

  it("asks before switching off", async () => {
    await show({ ...local, enabled: true });
    state.put.mockResolvedValue(local);
    fireEvent.click(theSwitch());
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("AI buttons disappear for everyone. Nothing already saved changes.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off AI" }));
    await waitFor(() => expect(state.put).toHaveBeenCalledWith("/org/ai", { enabled: false }));
    expect(state.toast).toHaveBeenCalledWith("AI assistant is off", expect.any(String));
  });
});

describe("US-AI-02", () => {
  it("shows a saved key only as its last four characters, with Replace key", async () => {
    await show(cloud);
    expect((screen.getByDisplayValue("••••1a2b") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Replace key" }));
    expect(screen.getByLabelText("API key")).toBeTruthy();
  });

  it("offers both providers and asks a local one for its address, model and optional key", async () => {
    await show(DEFAULT_AI_SETTINGS);
    fireEvent.click(screen.getByRole("radio", { name: "Local or OpenAI-compatible" }));
    expect(screen.getByLabelText("Server address")).toBeTruthy();
    expect(screen.getByText("Model")).toBeTruthy();
    expect(screen.getByLabelText("API key (optional)")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Anthropic Claude" }));
    expect(screen.queryByLabelText("Server address")).toBeNull();
    expect(screen.getByLabelText("API key")).toBeTruthy();
  });

  it("tests the connection and says what the model can do", async () => {
    await show(local);
    state.post.mockResolvedValue({ ok: true, model: "llama3.2-vision", supportsImages: true, models: ["llama3.2-vision"] });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect((await screen.findByTestId("ai-connection")).textContent).toBe("Connected · llama3.2-vision · reads images: yes");
    expect(state.post).toHaveBeenCalledWith("/org/ai/test", { driver: "openai-compatible", baseUrl: "http://192.168.1.20:11434/v1", model: "llama3.2-vision" });
  });

  it("says why a connection failed and what to do", async () => {
    await show(local);
    state.post.mockResolvedValue({ ok: false, model: "llama3.2-vision", supportsImages: null, models: [], error: "Couldn't reach http://192.168.1.20:11434/v1: the connection was refused. Check the address and key, then try again." });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect((await screen.findByTestId("ai-connection")).textContent).toBe("Couldn't reach http://192.168.1.20:11434/v1: the connection was refused. Check the address and key, then try again.");
  });

  it("moving a switched-on assistant to a cloud address asks first, then saves with the acknowledgement", async () => {
    await show({ ...local, enabled: true });
    fireEvent.change(screen.getByLabelText("Server address"), { target: { value: "https://llm.example.com/v1" } });
    state.put.mockRejectedValueOnce(new Error("Confirm what will be sent to llm.example.com first.")).mockResolvedValueOnce({ ...local, enabled: true, baseUrl: "https://llm.example.com/v1", providerHost: "llm.example.com", local: false });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Business data will be sent to llm.example.com");
    fireEvent.click(within(dialog).getByRole("button", { name: "Use this provider" }));
    await waitFor(() => expect(state.put).toHaveBeenLastCalledWith("/org/ai", { driver: "openai-compatible", baseUrl: "https://llm.example.com/v1", model: "llama3.2-vision", acknowledged: true }));
    expect(state.toast).toHaveBeenCalledWith("AI provider saved", expect.any(String));
  });
});

describe("US-AI-03", () => {
  const on = { ...local, enabled: true, supportsImages: false };

  it("with AI on, lists the four features with a switch each, where they show and what they send", async () => {
    await show(on);
    const list = screen.getByTestId("ai-features");
    for (const label of ["Read bills and receipts", "Draft customer emails", "Draft quote lines", "Suggest bank matches"]) {
      expect(within(list).getByRole("switch", { name: label }).getAttribute("aria-checked")).toBe("true");
    }
    expect(list.textContent).toContain("Needs a model that can read images. PDFs with text still work.");
    fireEvent.click(within(list).getAllByRole("button", { name: "What's sent" })[1]!);
    expect(list.textContent).toContain("Sent: the email template, the document's number, amounts and dates, and the customer's name.");
    expect(list.textContent).toContain("Never sent: bank account numbers, tax IDs and GSTINs, UPI IDs, passwords or keys.");
  });

  it("switches a feature off as it changes, and says so", async () => {
    await show(on);
    state.put.mockResolvedValue({ ...on, features: { ...on.features, draftEmails: false } });
    fireEvent.click(screen.getByRole("switch", { name: "Draft customer emails" }));
    await waitFor(() => expect(state.put).toHaveBeenCalledWith("/org/ai", { features: { draftEmails: false } }));
    expect(state.toast).toHaveBeenCalledWith("Draft customer emails is off", expect.any(String));
  });

  it("shows no features or budget while AI is off", async () => {
    await show(local);
    expect(screen.queryByTestId("ai-features")).toBeNull();
    expect(screen.queryByTestId("ai-budget")).toBeNull();
  });
});

describe("US-AI-04", () => {
  const on = { ...local, enabled: true, supportsImages: true, monthlyTokenBudget: 2_000_000 };
  const usage: AiUsage = {
    month: "2026-10",
    budget: 2_000_000,
    used: 1_240_560,
    requests: 318,
    percent: 62,
    byFeature: [{ feature: "readDocuments", tokens: 880_000, percent: 71 }, { feature: "draftEmails", tokens: 220_000, percent: 18 }],
    byUser: [{ userId: "u1", name: "Kavya Iyer", tokens: 600_000, percent: 48 }],
    pausedUntil: null,
  };

  it("shows this month's usage against the budget, with the top features and people", async () => {
    await show(on, usage);
    const budget = await screen.findByTestId("ai-budget");
    expect(within(budget).getByTestId("ai-usage").textContent).toBe(`${(1_240_560).toLocaleString()} of ${(2_000_000).toLocaleString()} tokens · 62%318 requests`);
    expect(within(budget).getByRole("progressbar")).toBeTruthy();
    expect(budget.textContent).toContain("Read bills and receipts71%");
    expect(budget.textContent).toContain("Kavya Iyer48%");
  });

  it("says when AI is paused, and until when", async () => {
    await show(on, { ...usage, used: 2_010_000, percent: 101, pausedUntil: "2026-11-01" });
    expect((await screen.findByTestId("ai-budget")).textContent).toContain("AI is paused until 1 November — this month's budget is used up.");
  });

  it("saves a budget, and an empty one means no limit", async () => {
    await show(on, usage);
    fireEvent.change(screen.getByLabelText("Tokens a month"), { target: { value: "" } });
    state.put.mockResolvedValue({ ...on, monthlyTokenBudget: null });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(state.put).toHaveBeenCalledWith("/org/ai", { monthlyTokenBudget: null }));
    expect(state.toast).toHaveBeenCalledWith("Monthly budget saved", "AI has no monthly limit.");
  });

  it("refuses a budget that isn't a number", async () => {
    await show(on, usage);
    fireEvent.change(screen.getByLabelText("Tokens a month"), { target: { value: "lots" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Enter the budget as a whole number of tokens, or leave it empty for no limit.");
    expect(state.put).not.toHaveBeenCalled();
  });
});
