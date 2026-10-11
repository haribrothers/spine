import { describe, expect, it } from "vitest";
import { filterInvoices, hasInvoiceFilters, invoicesQuery, matchesInvoiceSearch, parseInvoicesState } from "../app/(app)/invoices/invoices-list-state";
import { invoice } from "./invoice-fixtures";

const now = new Date(2026, 9, 10, 12);

describe("US-INV-28 · find an invoice by what's on it, and keep my place", () => {
  it("keeps the search, statuses, contact, card, sort and page in the address, leaving defaults out", () => {
    const state = parseInvoicesState(new URLSearchParams("q=canopy&status=overdue&status=part_paid&contact=c1&card=due7&sort=dueDate.asc&page=3"));
    expect(state).toEqual({ q: "canopy", status: ["overdue", "part_paid"], contact: "c1", card: "due7", sort: { key: "dueDate", direction: "asc" }, page: 3 });
    expect(parseInvoicesState(new URLSearchParams(invoicesQuery(state)))).toEqual(state);
    expect(invoicesQuery(parseInvoicesState(new URLSearchParams("")))).toBe("");
    expect(hasInvoiceFilters(parseInvoicesState(new URLSearchParams("sort=total.desc")))).toBe(false);
  });

  it("reads the old ?status=issued and a comma list, and ignores what it doesn't know", () => {
    expect(parseInvoicesState(new URLSearchParams("status=issued,overdue&status=sent&card=nope")).status).toEqual(["due", "overdue"]);
    expect(parseInvoicesState(new URLSearchParams("card=nope")).card).toBe("");
  });

  it("matches the number, customer, a line's name or the job", () => {
    const inv = invoice({ number: "INV-0038", lineNames: ["Loading bay canopy"], job: { id: "j", name: "Warehouse extension", number: "JOB-002" } });
    for (const q of ["inv-0038", "sahyadri", "CANOPY", "job-002", "warehouse"]) expect(matchesInvoiceSearch(inv, q)).toBe(true);
    expect(matchesInvoiceSearch(inv, "roofing")).toBe(false);
  });

  it("filters by status, contact and card together", () => {
    const list = [
      invoice({ number: "A", isOverdue: true, dueDate: "2026-10-01" }),
      invoice({ number: "B", contactId: "c2", isOverdue: true, dueDate: "2026-10-01" }),
      invoice({ number: "C", dueDate: "2026-10-12" }),
    ];
    const state = parseInvoicesState(new URLSearchParams("status=overdue&contact=c1"));
    expect(filterInvoices(list, state, now).map((i) => i.number)).toEqual(["A"]);
    expect(filterInvoices(list, parseInvoicesState(new URLSearchParams("card=due7")), now).map((i) => i.number)).toEqual(["C"]);
  });
});
