import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_UNAVAILABLE_MESSAGE, aiPausedMessage, type AiEmailDraft, type AiStatus, type EmailDraft } from "@spine/shared";

const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), status: null as AiStatus | null }));
vi.mock("../lib/api-client", async (original) => ({ ...(await original<typeof import("../lib/api-client")>()), apiClient: { get: state.get, post: state.post } }));
vi.mock("../lib/use-ai-status", async (original) => ({ ...(await original<typeof import("../lib/use-ai-status")>()), useAiStatus: () => state.status }));

import { ApiError } from "../lib/api-client";
import { SendEmailDialog } from "../components/send-email-dialog";

const TEMPLATE: EmailDraft = {
  type: "reminder",
  to: "accounts@halcyon.example",
  subject: "Reminder: invoice DEMO-INV-0010 is 35 days overdue",
  message: "<p>Hi Halcyon,</p><p>This is a friendly reminder that invoice DEMO-INV-0010 is 35 days overdue.</p>",
  hasPdf: true,
  values: ["is 35 days overdue", "DEMO-INV-0010", "Halcyon"],
};
const AI_DRAFT: AiEmailDraft = {
  subject: "Invoice DEMO-INV-0010 is 35 days overdue — please arrange payment",
  message: "<p>Hi Halcyon,</p><p>Invoice DEMO-INV-0010 for ₹9,68,780.00 is still outstanding.</p><p>Regards,<br>Shilpa Buildcon</p>",
  values: ["is 35 days overdue", "Shilpa Buildcon", "₹9,68,780.00", "DEMO-INV-0010", "Halcyon"],
};
const ALLOWED: AiStatus = { canUse: true, canReadOwnReceipt: true, supportsImages: true, features: { readDocuments: true, draftEmails: true, draftQuoteLines: true, bankSuggestions: true }, pausedUntil: null };

const onSend = vi.fn(async () => {});
function open() {
  render(<SendEmailDialog open onOpenChange={() => {}} title="Send payment reminder — DEMO-INV-0010" draftPath="/email-drafts/reminder/inv-1" sendLabel="Send reminder" pdfLabel="Attach the invoice PDF" onSend={onSend} />);
}
const subject = () => screen.getByLabelText("Subject") as HTMLInputElement;
const message = () => screen.getByRole("textbox", { name: "Message" });
const highlighted = (root: HTMLElement) => [...root.querySelectorAll("[data-highlight]")].map((el) => el.textContent);

beforeEach(() => {
  state.get.mockReset().mockResolvedValue(TEMPLATE);
  state.post.mockReset();
  onSend.mockClear();
  state.status = ALLOWED;
});

describe("US-AI-11", () => {
  it("opens with the template, the details Spine filled in highlighted, and \"Draft with AI\" for someone who may use it", async () => {
    open();
    await waitFor(() => expect(subject().value).toBe(TEMPLATE.subject));
    await waitFor(() => expect(highlighted(message())).toEqual(["Halcyon", "DEMO-INV-0010", "is 35 days overdue"]));
    expect(screen.getByText("Starts from your template in Settings › Emails. Highlighted words are this invoice's details — Spine fills them in. Changes here apply to this email only.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Draft with AI" })).toBeTruthy();
  });

  it("shows no AI control with the feature off or without the right", async () => {
    state.status = { ...ALLOWED, features: { ...ALLOWED.features, draftEmails: false } };
    open();
    await waitFor(() => expect(subject().value).toBe(TEMPLATE.subject));
    expect(screen.queryByRole("button", { name: "Draft with AI" })).toBeNull();
  });

  it("shows AI's draft as a suggestion and leaves the email as it is until \"Use this draft\"; Undo puts it back", async () => {
    state.post.mockResolvedValueOnce(AI_DRAFT);
    open();
    await waitFor(() => expect(subject().value).toBe(TEMPLATE.subject));
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));

    const suggestion = await screen.findByRole("region", { name: "AI's draft" });
    expect(state.post).toHaveBeenCalledWith("/ai/draft-email", { type: "reminder", documentId: "inv-1", tone: "friendly" }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(within(suggestion).getByText(/please arrange payment/)).toBeTruthy();
    expect(highlighted(suggestion)).toContain("₹9,68,780.00");
    // The email itself hasn't changed.
    expect(subject().value).toBe(TEMPLATE.subject);
    expect(screen.queryAllByText("Drafted by AI")).toHaveLength(0);

    fireEvent.click(within(suggestion).getByRole("button", { name: "Use this draft" }));
    await waitFor(() => expect(subject().value).toBe(AI_DRAFT.subject));
    await waitFor(() => expect(message().textContent).toContain("for ₹9,68,780.00 is still outstanding"));
    expect(screen.queryByRole("region", { name: "AI's draft" })).toBeNull();
    expect(screen.getAllByText("Drafted by AI")).toHaveLength(2);
    expect(screen.getByText("Using AI's draft — check it before sending.")).toBeTruthy();
    await waitFor(() => expect(highlighted(message())).toEqual(expect.arrayContaining(["₹9,68,780.00", "Shilpa Buildcon"])));

    // Changing the subject takes its tag away.
    fireEvent.change(subject(), { target: { value: "Invoice DEMO-INV-0010" } });
    expect(screen.getAllByText("Drafted by AI")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(subject().value).toBe(TEMPLATE.subject));
    await waitFor(() => expect(message().textContent).toContain("This is a friendly reminder"));
    expect(screen.queryAllByText("Drafted by AI")).toHaveLength(0);
  });

  it("Try again gives another draft; Discard closes it with nothing changed", async () => {
    state.post.mockResolvedValueOnce(AI_DRAFT).mockResolvedValueOnce({ ...AI_DRAFT, subject: "DEMO-INV-0010: payment needed" });
    open();
    await waitFor(() => expect(subject().value).toBe(TEMPLATE.subject));
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
    const suggestion = await screen.findByRole("region", { name: "AI's draft" });
    fireEvent.click(within(suggestion).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(within(screen.getByRole("region", { name: "AI's draft" })).getByText((_, el) => el?.tagName === "P" && el.textContent === "DEMO-INV-0010: payment needed")).toBeTruthy());
    expect(state.post).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("region", { name: "AI's draft" })).toBeNull();
    expect(subject().value).toBe(TEMPLATE.subject);
  });

  it("when AI doesn't answer, says so with Try again and the email is as it was", async () => {
    state.post.mockRejectedValueOnce(new ApiError(AI_UNAVAILABLE_MESSAGE, 503, { error: "AI_UNAVAILABLE" }));
    open();
    await waitFor(() => expect(subject().value).toBe(TEMPLATE.subject));
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
    expect(await screen.findByText("AI didn't answer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(subject().value).toBe(TEMPLATE.subject);
  });

  it("Send sends exactly what the dialog holds", async () => {
    state.post.mockResolvedValueOnce(AI_DRAFT);
    open();
    await waitFor(() => expect(subject().value).toBe(TEMPLATE.subject));
    fireEvent.click(screen.getByRole("button", { name: "Draft with AI" }));
    fireEvent.click(within(await screen.findByRole("region", { name: "AI's draft" })).getByRole("button", { name: "Use this draft" }));
    await waitFor(() => expect(subject().value).toBe(AI_DRAFT.subject));
    fireEvent.click(screen.getByRole("button", { name: "Send reminder" }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith({ to: TEMPLATE.to, subject: AI_DRAFT.subject, message: AI_DRAFT.message, attachPdf: true }));
  });

  it("a paused budget shows the button dimmed with when AI is back", async () => {
    state.status = { ...ALLOWED, pausedUntil: "2026-11-01" };
    open();
    await waitFor(() => expect(subject().value).toBe(TEMPLATE.subject));
    expect((screen.getByRole("button", { name: "Draft with AI" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(aiPausedMessage("2026-11-01"))).toBeTruthy();
  });
});
