import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentConsentInfo } from "@spine/shared";

const QUERY = "response_type=code&client_id=abc&scope=spine%3Aread+spine%3Adraft&sig=s";
const state = vi.hoisted(() => ({ get: vi.fn(), fetch: vi.fn(), signOut: vi.fn(), assign: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(QUERY) }));
vi.mock("../lib/api-client", () => ({ apiClient: { get: state.get } }));
vi.mock("../lib/auth-client", () => ({ authClient: { $fetch: state.fetch, signOut: state.signOut } }));
vi.mock("../components/auth-frame", () => ({
  AuthFrame: ({ children, panel }: { children: React.ReactNode; panel?: React.ReactNode }) => (
    <div>
      {children}
      {panel}
    </div>
  ),
  AuthHeading: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  ),
}));

import AgentConsentPage from "../app/oauth/consent/page";

const owner: AgentConsentInfo = { off: false, business: "Meridian Builders", agent: { name: "Claude", host: "claude.ai", verified: true }, person: { name: "Priya Raman", role: "owner", image: null }, draftsOffered: true };

beforeEach(() => {
  for (const fn of Object.values(state)) fn.mockReset();
  Object.defineProperty(window, "location", { value: { ...window.location, assign: state.assign }, writable: true });
});

describe("US-MCP-03 · the consent page", () => {
  it("names the agent and its verified address, who it acts as, what it can and can't do, and where data goes", async () => {
    state.get.mockResolvedValue(owner);
    render(<AgentConsentPage />);
    expect(await screen.findByRole("heading", { name: "Claude wants to use Spine as you" })).toBeTruthy();
    expect(state.get).toHaveBeenCalledWith(`/agent-consent?${QUERY}`);
    expect(screen.getByTestId("agent-host").textContent).toContain("claude.ai");
    expect(screen.getByTestId("agent-host").textContent).toContain("Verified address");
    expect(screen.getByText(/Signed in as/).textContent).toContain("Priya Raman");
    expect(screen.getByText("Read what you can see in Spine — contacts, quotes, jobs, invoices, bills and the reports you can open")).toBeTruthy();
    expect(screen.getByText("Create drafts for you to check")).toBeTruthy();
    expect(screen.getByText("It can't issue, send, record payments, delete or change settings.")).toBeTruthy();
    expect(screen.getByTestId("agent-sends").textContent).toBe("What it reads is sent to Claude's AI provider. You can disconnect it any time in Settings › Your account › Connected agents.");
  });

  it("an agent that registered itself leads with its host and marks its name unverified; Field hears only what Field can do", async () => {
    state.get.mockResolvedValue({ ...owner, agent: { name: "Site Notes Helper", host: "agent.example.net", verified: false }, person: { name: "Marcus Webb", role: "field", image: null } });
    render(<AgentConsentPage />);
    expect(await screen.findByRole("heading", { name: "agent.example.net wants to use Spine as you" })).toBeTruthy();
    expect(screen.getByTestId("agent-host").textContent).toContain("Calls itself “Site Notes Helper”");
    expect(screen.getByTestId("agent-host").textContent).toContain("Unverified name");
    expect(screen.getByText("Read your assigned jobs, contacts and the catalogue")).toBeTruthy();
    expect(screen.getByText("Add notes to your jobs")).toBeTruthy();
    expect(screen.getByText("It can't see money or reports, and can't issue, send, record or delete anything.")).toBeTruthy();
    expect(screen.getByTestId("agent-sends").textContent).toContain("Only allow it if you added agent.example.net yourself.");
    expect(document.body.textContent).not.toMatch(/invoices|reports you can open/);
  });

  it("Allow sends the requested scopes — without drafts when unticked — and follows Better Auth back to the agent", async () => {
    state.get.mockResolvedValue(owner);
    state.fetch.mockResolvedValue({ data: { redirect: true, url: "https://claude.ai/callback?code=x" }, error: null });
    render(<AgentConsentPage />);
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Allow" }));
    await waitFor(() => expect(state.fetch).toHaveBeenCalledWith("/oauth2/consent", { method: "POST", body: { accept: true, scope: "spine:read" } }));
    expect(state.assign).toHaveBeenCalledWith("https://claude.ai/callback?code=x");
  });

  it("Cancel answers no; with drafts not offered, Allow asks for read only", async () => {
    state.get.mockResolvedValue({ ...owner, draftsOffered: false });
    state.fetch.mockResolvedValue({ data: { redirect: true, url: "https://claude.ai/callback?error=access_denied" }, error: null });
    const { unmount } = render(<AgentConsentPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(state.fetch).toHaveBeenCalledWith("/oauth2/consent", { method: "POST", body: { accept: false } }));
    unmount();
    render(<AgentConsentPage />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Allow" }));
    await waitFor(() => expect(state.fetch).toHaveBeenLastCalledWith("/oauth2/consent", { method: "POST", body: { accept: true, scope: "spine:read" } }));
  });

  it("says when connected agents are off, and when the request can't be used", async () => {
    state.get.mockResolvedValue({ ...owner, off: true });
    const { unmount } = render(<AgentConsentPage />);
    expect(await screen.findByText("Connected agents are turned off for Meridian Builders. Ask an Owner to turn them on.")).toBeTruthy();
    unmount();
    state.get.mockRejectedValue(new Error("This request has expired. Go back to your agent and connect again."));
    render(<AgentConsentPage />);
    expect(await screen.findByText("This request has expired. Go back to your agent and connect again.")).toBeTruthy();
  });

  it("Not you? signs out and returns to log-in with the same request", async () => {
    state.get.mockResolvedValue(owner);
    state.signOut.mockResolvedValue({});
    render(<AgentConsentPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Not you?" }));
    await waitFor(() => expect(state.assign).toHaveBeenCalledWith(`/login?${QUERY}`));
  });
});
