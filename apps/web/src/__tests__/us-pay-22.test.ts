import { describe, expect, it } from "vitest";
import { filterPayments, hasPaymentFilters, matchesPaymentSearch, parsePaymentsState, paymentsQuery, rangeBounds } from "../app/(app)/payments/payments-list-state";
import { payment } from "./payment-fixtures";

const now = new Date(2026, 9, 11, 12);

describe("US-PAY-22 · search, filter and come back to the same payments list", () => {
  it("keeps the search, contact, method, range, card, sort and page in the address, leaving defaults out", () => {
    const state = parsePaymentsState(new URLSearchParams("q=halcyon&contact=c1&method=upi&method=cheque&range=this_month&card=credit&sort=amount.desc&page=2"));
    expect(state).toEqual({ q: "halcyon", contact: "c1", method: ["upi", "cheque"], range: "this_month", card: "credit", sort: { key: "amount", direction: "desc" }, page: 2 });
    expect(parsePaymentsState(new URLSearchParams(paymentsQuery(state)))).toEqual(state);
    expect(paymentsQuery(parsePaymentsState(new URLSearchParams("method=nope&range=nope&card=nope")))).toBe("");
    expect(hasPaymentFilters(parsePaymentsState(new URLSearchParams("sort=amount.desc")))).toBe(false);
  });

  it("matches the receipt number, reference, customer and the invoices it was applied to", () => {
    const p = payment();
    for (const q of ["rcp-0031", "4471", "HALCYON", "inv-0039"]) expect(matchesPaymentSearch(p, q)).toBe(true);
    expect(matchesPaymentSearch(p, "sahyadri")).toBe(false);
  });

  it("works out each date range, the financial year from its start", () => {
    expect(rangeBounds("this_month", now)).toEqual(["2026-10-01", "2026-10-11"]);
    expect(rangeBounds("last_month", now)).toEqual(["2026-09-01", "2026-09-30"]);
    expect(rangeBounds("90", now)).toEqual(["2026-07-14", "2026-10-11"]);
    expect(rangeBounds("fy", now, { month: 4, day: 1 })).toEqual(["2026-04-01", "2026-10-11"]);
    expect(rangeBounds("fy", new Date(2027, 1, 2), { month: 4, day: 1 })).toEqual(["2026-04-01", "2027-02-02"]);
    expect(rangeBounds("all", now)).toBeNull();
  });

  it("filters by contact, method, range and the Credit to use card together", () => {
    const list = [payment({ id: "a" }), payment({ id: "b", method: "cheque", unallocatedAmount: "100" }), payment({ id: "c", date: "2026-08-01", unallocatedAmount: "100" }), payment({ id: "d", contactId: "c2", unallocatedAmount: "100" })];
    const ids = (q: string) => filterPayments(list, parsePaymentsState(new URLSearchParams(q)), now).map((p) => p.id);
    expect(ids("card=credit")).toEqual(["b", "c", "d"]);
    expect(ids("card=credit&range=this_month")).toEqual(["b", "d"]);
    expect(ids("method=cheque")).toEqual(["b"]);
    expect(ids("contact=c2")).toEqual(["d"]);
  });
});
