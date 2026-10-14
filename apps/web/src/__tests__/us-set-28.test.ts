import { describe, expect, it } from "vitest";
import { emailDescription, emailNote } from "../app/(app)/emails/emails-list-state";
import { email } from "./email-log-fixtures";

describe("US-SET-28 · retry or cancel an email", () => {
  it("says under the subject why it failed, when it's tried again, or who cancelled it", () => {
    expect(emailNote(email({ status: "failed", lastError: "550 5.1.1 Mailbox unavailable" }), "en-GB")).toEqual({ text: "550 5.1.1 Mailbox unavailable", error: true });
    expect(emailNote(email({ status: "retrying", lastError: "Connection timed out", nextAttemptAt: "2026-10-11T06:58:00.000Z" }), "en-GB")!.text).toMatch(/^Retrying at .+ · Connection timed out$/);
    expect(emailNote(email({ status: "cancelled", cancelledByName: "Priya Raman" }))).toEqual({ text: "Cancelled by Priya Raman", error: false });
    expect(emailNote(email({ status: "queued", waitingForSetup: true }))).toEqual({ text: "Waiting for email to be set up", error: false });
    expect(emailNote(email())).toBeNull();
  });

  it("names the email in the confirmations by its kind and record", () => {
    expect(emailDescription(email({ kind: "invoice_reminder", recordLabel: "INV-0039" }))).toBe("The payment reminder for INV-0039");
    expect(emailDescription(email({ kind: "notification", recordLabel: null, subject: "Milestone completed" }))).toBe("“Milestone completed”");
  });
});
