import { describe, expect, it } from "vitest";
import { billState, billStats, filterBills, lateLabel, parseVendorBillsState, suggestedDueDays, vendorBillsQuery } from "../app/(app)/vendor-bills/vendor-bill-state";
import { fillCredits } from "../app/(app)/vendor-bills/apply-credit-to-bill-dialog";
import type { VendorBill } from "../app/(app)/vendor-bills/types";

const today = new Date(2026, 9, 11);
const bill = (over: Partial<VendorBill>): VendorBill =>
  ({
    id: "b",
    contactId: "v1",
    contactName: "Ridgeline Equipment Rentals",
    jobId: null,
    jobName: null,
    status: "recorded",
    billNumber: "RTE-3302",
    date: "2026-09-25",
    dueDate: "2026-10-15",
    currency: "INR",
    totalAmount: "11564000",
    amountPaid: "0",
    creditedAmount: "0",
    balanceDue: "11564000",
    createdAt: "2026-09-25T10:00:00Z",
    ...over,
  }) as VendorBill;

describe("US-PUR-32 · see a bill at a glance", () => {
  it("says where a bill stands in words", () => {
    expect(billState(bill({ status: "draft" }), today)).toBe("draft");
    expect(billState(bill({ status: "void" }), today)).toBe("void");
    expect(billState(bill({}), today)).toBe("unpaid");
    expect(billState(bill({ amountPaid: "7500000", balanceDue: "4064000" }), today)).toBe("partly");
    expect(billState(bill({ creditedAmount: "100", balanceDue: "11563900" }), today)).toBe("partly");
    expect(billState(bill({ balanceDue: "0", amountPaid: "11564000" }), today)).toBe("paid");
    expect(billState(bill({ dueDate: "2026-09-11" }), today)).toBe("overdue");
    expect(billState(bill({ dueDate: "2026-09-11", amountPaid: "100", balanceDue: "11563900" }), today)).toBe("overdue");
  });

  it("says how late only while money is owed", () => {
    expect(lateLabel(bill({}), today)).toBe("Due in 4 days");
    expect(lateLabel(bill({ dueDate: "2026-10-11" }), today)).toBe("Due today");
    expect(lateLabel(bill({ dueDate: "2026-09-11" }), today)).toBe("30 days late");
    expect(lateLabel(bill({ dueDate: "2026-10-10" }), today)).toBe("1 day late");
    expect(lateLabel(bill({ balanceDue: "0" }), today)).toBeNull();
    expect(lateLabel(bill({ status: "draft" }), today)).toBeNull();
    expect(lateLabel(bill({ dueDate: null }), today)).toBeNull();
  });
});

describe("US-PUR-33 · pay a bill from its page", () => {
  it("fills the vendor's credits, oldest first, up to what the bill owes", () => {
    expect(fillCredits([{ id: "a", balanceAmount: "500" }, { id: "b", balanceAmount: "800" }], 1000n)).toEqual({ a: 500n, b: 500n });
    expect(fillCredits([{ id: "a", balanceAmount: "500" }, { id: "b", balanceAmount: "800" }], 300n)).toEqual({ a: 300n, b: 0n });
  });
});

describe("US-PUR-34 · see what we owe vendors at a glance", () => {
  const bills = [
    bill({ id: "d1", status: "draft", totalAmount: "26432000", balanceDue: "26432000" }),
    bill({ id: "d2", status: "draft", totalAmount: "4248000", balanceDue: "4248000", contactId: "v2", contactName: "Kaveri Sand" }),
    bill({ id: "u", dueDate: "2026-10-31", totalAmount: "18054000", balanceDue: "18054000", contactName: "Apex Building Materials", contactId: "v3" }),
    bill({ id: "p", amountPaid: "7500000", balanceDue: "4064000", jobId: "j1", jobName: "Wing C fit-out" }),
    bill({ id: "o", dueDate: "2026-09-11", totalAmount: "41064000", balanceDue: "41064000" }),
    bill({ id: "paid", balanceDue: "0", amountPaid: "8500000" }),
    bill({ id: "v", status: "void" }),
    bill({ id: "usd", currency: "USD", dueDate: "2026-09-11" }),
  ];

  it("adds up To pay, Overdue, Due in 7 days and Drafts in the business's currency", () => {
    const stats = billStats(bills, "INR", today);
    expect(stats.toPay).toEqual({ amount: 18054000n + 4064000n + 41064000n, count: 3 });
    expect(stats.overdue).toEqual({ amount: 41064000n, count: 1 });
    expect(stats.due7.amount).toBe(4064000n);
    expect(stats.due7.count).toBe(1);
    expect(stats.drafts).toEqual({ amount: 26432000n + 4248000n, count: 2 });
  });

  it("filters by card, state, vendor and search (bill number, vendor or job)", () => {
    const state = parseVendorBillsState(new URLSearchParams(""));
    const ids = (s: Partial<typeof state>) => filterBills(bills, { ...state, ...s }, today, (id) => (id === "j1" ? "Wing C fit-out" : null)).map((b) => b.id);
    expect(ids({ card: "overdue" })).toEqual(["o", "usd"]);
    expect(ids({ card: "due7" })).toEqual(["p"]);
    expect(ids({ card: "drafts" })).toEqual(["d1", "d2"]);
    expect(ids({ states: ["partly", "paid"] })).toEqual(["p", "paid"]);
    expect(ids({ vendor: "v3" })).toEqual(["u"]);
    expect(ids({ q: "wing c" })).toEqual(["p"]);
    expect(ids({ q: "kaveri" })).toEqual(["d2"]);
  });

  it("keeps state, vendor, job, card, search, sort and page in the address", () => {
    const state = parseVendorBillsState(new URLSearchParams("state=overdue,partly,bogus&vendor=v1&card=due7&q=rte&sort=total.desc&page=3"));
    expect(state).toEqual({ states: ["overdue", "partly"], vendor: "v1", card: "due7", q: "rte", sort: { key: "total", direction: "desc" }, page: 3 });
    expect(vendorBillsQuery(state, "j1")).toBe("state=overdue%2Cpartly&vendor=v1&jobId=j1&card=due7&q=rte&sort=total.desc&page=3");
    expect(vendorBillsQuery(parseVendorBillsState(new URLSearchParams("")))).toBe("");
  });
});

describe("US-PUR-35 · enter a bill faster", () => {
  it("suggests the due date from the vendor's last bill (not a void one)", () => {
    expect(suggestedDueDays([bill({ date: "2026-08-01", dueDate: "2026-08-31" }), bill({ date: "2026-09-01", dueDate: "2026-09-16", createdAt: "2026-09-01T00:00:00Z" })])).toBe(15);
    expect(suggestedDueDays([bill({ date: "2026-09-01", dueDate: "2026-10-01" }), bill({ date: "2026-10-01", dueDate: "2026-10-03", status: "void" })])).toBe(30);
    expect(suggestedDueDays([bill({ dueDate: null })])).toBeNull();
    expect(suggestedDueDays([])).toBeNull();
  });
});
