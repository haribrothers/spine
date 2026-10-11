import { describe, expect, it } from "vitest";
import type { CreditNoteActivityEntry } from "@spine/shared";
import { creditNoteActivityText } from "../app/(app)/credit-notes/credit-note-activity";

const entry = (type: CreditNoteActivityEntry["type"], over: Partial<CreditNoteActivityEntry> = {}): CreditNoteActivityEntry => ({ type, at: "2026-10-06T05:30:00Z", actorName: "Priya Raman", detail: null, ...over });

describe("US-INV-39 · follow what happened to a credit note", () => {
  it("says what came off the invoice and what became credit when it was issued", () => {
    const text = creditNoteActivityText(entry("issued", { detail: "INV-0041", amount: "4161600", creditPart: "1785600" }), "INR");
    expect(text.text).toBe("Issued against");
    expect(text.link).toBe("INV-0041");
    expect(text.after).toMatch(/41,616\.00 off it, .*17,856\.00 as credit$/);
  });

  it("names what was applied, emailed and refunded", () => {
    expect(creditNoteActivityText(entry("applied", { detail: "INV-0044", amount: "1000000" }), "INR")).toMatchObject({ link: "INV-0044" });
    expect(creditNoteActivityText(entry("emailed", { detail: "accounts@sahyadri.example" }), "INR").text).toBe("Emailed to accounts@sahyadri.example");
    expect(creditNoteActivityText(entry("refunded", { detail: "bank_transfer", amount: "590000" }), "INR").text).toMatch(/^Refunded · .*5,900\.00 · Bank transfer$/);
    expect(creditNoteActivityText(entry("refund_deleted", { amount: "590000" }), "INR").text).toMatch(/^Refund deleted/);
  });
});
