import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiEmailDraft, AiStatus, EmailDraft } from "@spine/shared";

const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), status: null as AiStatus | null }));
vi.mock("../lib/api-client", async (original) => ({ ...(await original<typeof import("../lib/api-client")>()), apiClient: { get: state.get, post: state.post } }));
vi.mock("../lib/use-ai-status", async (original) => ({ ...(await original<typeof import("../lib/use-ai-status")>()), useAiStatus: () => state.status }));

import { SendEmailDialog } from "../components/send-email-dialog";

const REMINDER: EmailDraft = { type: "reminder", to: "accounts@halcyon.example", subject: "Reminder: invoice INV-0042 is 35 days overdue", message: "<p>Hi Alan,</p>", hasPdf: true, values: ["INV-0042", "Alan"] };
const DRAFT: AiEmailDraft = { subject: "Invoice INV-0042 is 35 days overdue", message: "<p>Hi Alan,</p><p>$800.00 is overdue.</p>", values: ["$800.00", "INV-0042", "Alan"] };
const ALLOWED: AiStatus = { canUse: true, canReadOwnReceipt: true, supportsImages: true, features: { readDocuments: true, draftEmails: true, draftQuoteLines: true, bankSuggestions: true }, pausedUntil: null };

function open(type: "reminder" | "invoice") {
  render(<SendEmailDialog open onOpenChange={() => {}} title="Send" draftPath={`/email-drafts/${type}/inv-1`} sendLabel="Send" onSend={async () => {}} />);
}
const tone = (root: HTMLElement = document.body) => within(root).getByLabelText("Tone");
const sentTone = (call: number) => (state.post.mock.calls[call]![1] as { tone?: string }).tone;

beforeEach(() => {
  state.get.mockReset().mockResolvedValue(REMINDER);
  state.post.mockReset().mockResolvedValue(DRAFT);
  state.status = ALLOWED;
});

describe("US-AI-12", () => {
  it("a reminder offers Friendly, Formal and Firm beside \"Draft with AI\" — Friendly until changed — and drafts in the chosen tone", async () => {
    open("reminder");
    await screen.findByRole("button", { name: "Draft with AI" });
    expect(within(tone()).getByRole("radio", { name: "Friendly" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(tone()).getByRole("radio", { name: "Firm" }));
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
    await screen.findByRole("region", { name: "AI's draft" });
    expect(state.post).toHaveBeenCalledWith("/ai/draft-email", { type: "reminder", documentId: "inv-1", tone: "firm" }, expect.anything());
  });

  it("choosing another tone on the suggestion drafts again in it", async () => {
    open("reminder");
    fireEvent.click(await screen.findByRole("button", { name: "Draft with AI" }));
    const suggestion = await screen.findByRole("region", { name: "AI's draft" });
    expect(sentTone(0)).toBe("friendly");
    fireEvent.click(within(tone(suggestion)).getByRole("radio", { name: "Formal" }));
    await waitFor(() => expect(state.post).toHaveBeenCalledTimes(2));
    expect(sentTone(1)).toBe("formal");
    // Try again keeps the chosen tone.
    await waitFor(() => expect(within(screen.getByRole("region", { name: "AI's draft" })).getByRole("button", { name: "Try again" })).toBeTruthy());
    fireEvent.click(within(screen.getByRole("region", { name: "AI's draft" })).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(state.post).toHaveBeenCalledTimes(3));
    expect(sentTone(2)).toBe("formal");
  });

  it("other emails have no tone", async () => {
    state.get.mockResolvedValue({ ...REMINDER, type: "invoice" });
    open("invoice");
    fireEvent.click(await screen.findByRole("button", { name: "Draft with AI" }));
    await screen.findByRole("region", { name: "AI's draft" });
    expect(screen.queryByLabelText("Tone")).toBeNull();
    expect(state.post.mock.calls[0]![1]).toEqual({ type: "invoice", documentId: "inv-1" });
  });
});
