import type { Page } from "@playwright/test";
import { api, isoDays } from "./quote-seed";

/** US-INV-27 to US-INV-35 — invoices made and moved on as the signed-in person. */
export async function invoice(
  page: Page,
  contactId: string,
  opts: { issueDays?: number; dueDays?: number; notes?: string; lines?: { name: string; price: string; quantity?: number; description?: string; tax?: number }[] } = {},
) {
  const lines = (opts.lines ?? [{ name: "Site visit", price: "100000" }]).map((l) => ({ type: "item", name: l.name, description: l.description, quantity: l.quantity ?? 1, unitPriceAmount: l.price, taxRatePercentage: l.tax ?? 0 }));
  return api<{ id: string; number: string | null }>(page, "POST", "/invoices", {
    contactId,
    currency: "USD",
    issueDate: opts.issueDays === undefined ? undefined : isoDays(opts.issueDays),
    dueDate: opts.dueDays === undefined ? undefined : isoDays(opts.dueDays),
    notes: opts.notes,
    lines,
  });
}

export async function issue(page: Page, invoiceId: string) {
  return api<{ id: string; number: string; issueDate: string | null; dueDate: string | null }>(page, "POST", `/invoices/${invoiceId}/issue`, {});
}

export async function pay(page: Page, contactId: string, invoiceId: string, amount: string, days = 0) {
  return api(page, "POST", "/payments", { contactId, date: isoDays(days), method: "bank_transfer", currency: "USD", amount, allocations: [{ invoiceId, amount }] });
}
