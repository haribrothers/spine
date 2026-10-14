import type { Page } from "@playwright/test";
import { api, isoDays } from "./quote-seed";

/** US-INV-36 to US-INV-41 — a customer with a taxed, issued invoice: 36 × $42.00 and 1 × $2,400.00, at 10% tax. */
export async function taxedInvoice(page: Page, contactId: string) {
  const rate = await api(page, "POST", "/tax-rates", { name: `Sales tax ${Math.random().toString(36).slice(2, 6)}`, rate: 10 });
  const draft = await api(page, "POST", "/invoices", {
    contactId,
    currency: "USD",
    lines: [
      { type: "item", name: "Loading bay canopy", quantity: 36, unitPriceAmount: "4200", taxRateId: rate.id },
      { type: "item", name: "Storm-water drainage", quantity: 1, unitPriceAmount: "240000", taxRateId: rate.id },
    ],
  });
  return api<{ id: string; number: string; totalAmount: string }>(page, "POST", `/invoices/${draft.id}/issue`, {});
}

export async function payInFull(page: Page, contactId: string, invoice: { id: string; totalAmount: string }) {
  return api(page, "POST", "/payments", { contactId, date: isoDays(0), method: "bank_transfer", currency: "USD", amount: invoice.totalAmount, allocations: [{ invoiceId: invoice.id, amount: invoice.totalAmount }] });
}

/** A credit note for `quantity` of the invoice's first line, issued. */
export async function creditFirstLine(page: Page, invoiceId: string, quantity: number, reason = "Canopy reduced") {
  const creditable = await api<{ lines: { invoiceLineId: string; name: string }[] }>(page, "GET", `/credit-notes/creditable?invoiceId=${invoiceId}`);
  const line = creditable.lines[0]!;
  const note = await api(page, "POST", "/credit-notes", { invoiceId, reason, lines: [{ invoiceLineId: line.invoiceLineId, quantity, name: line.name }] });
  return api<{ id: string; number: string; totalAmount: string; creditRemainingAmount: string }>(page, "POST", `/credit-notes/${note.id}/issue`, {});
}
