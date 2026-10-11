import { describe, expect, it } from "vitest";
import type { InvoiceActivityEntry } from "@spine/shared";
import { invoiceActivityText } from "../app/(app)/invoices/invoice-activity";

const entry = (type: InvoiceActivityEntry["type"], over: Partial<InvoiceActivityEntry> = {}): InvoiceActivityEntry => ({ type, at: "2026-10-02T09:40:00Z", actorName: "Priya Raman", detail: null, ...over });

describe("US-INV-32 · follow what happened to an invoice", () => {
  it("says what happened, with what it points at", () => {
    expect(invoiceActivityText(entry("created_from_quote", { detail: "QUO-0031" }), "INR")).toEqual({ text: "Created from quote", link: "QUO-0031" });
    expect(invoiceActivityText(entry("created_from_milestone", { detail: "Steel structure" }), "INR")).toEqual({ text: "Created from milestone", link: "Steel structure" });
    expect(invoiceActivityText(entry("duplicated", { detail: "INV-0031" }), "INR")).toEqual({ text: "Duplicated from", link: "INV-0031" });
    expect(invoiceActivityText(entry("emailed", { detail: "accounts@sahyadri.example" }), "INR").text).toBe("Emailed to accounts@sahyadri.example");
    expect(invoiceActivityText(entry("email_failed", { detail: "Mailbox full" }), "INR").text).toBe("Email failed: Mailbox full");
    expect(invoiceActivityText(entry("auto_reminder_sent"), "INR").text).toBe("Automatic reminder sent");
    expect(invoiceActivityText(entry("voided", { detail: "Raised twice." }), "INR").text).toBe("Voided: Raised twice.");
  });

  it("names a payment's amount, method and receipt", () => {
    const { text, link } = invoiceActivityText(entry("payment_recorded", { amount: "1000000", method: "bank_transfer", detail: "RCP-0028" }), "INR");
    expect(text).toMatch(/^Payment recorded · .*10,000\.00 · Bank transfer$/);
    expect(link).toBe("RCP-0028");
  });
});
