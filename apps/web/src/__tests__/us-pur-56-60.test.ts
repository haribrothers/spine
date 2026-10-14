import { describe, expect, it } from "vitest";
import { inPayablesAge, parsePayablesAge } from "@spine/shared";
import { draftsNote, emptyAge, filterBills, parsePayablesState, payablesQuery, payBlocked, vendorView } from "../app/(app)/payables/payables-list-state";
import type { PayablesBillRow, PayablesVendorRow } from "../app/(app)/payables/types";

const bill = (over: Partial<PayablesBillRow>): PayablesBillRow => ({
  id: "b",
  billNumber: "ABM-20587",
  contactId: "apex",
  contactName: "Apex Building Materials",
  currency: "INR",
  dueDate: "2026-08-26",
  totalAmount: "18054000",
  balanceDue: "18054000",
  daysOverdue: 47,
  bucket: "31-60",
  date: "2026-07-27",
  paidAmount: "0",
  jobId: "j",
  jobName: "Wing C fit-out",
  ...over,
});

const bills = [
  bill({ id: "late" }),
  bill({ id: "soon", billNumber: "ABM-20611", dueDate: "2026-10-17", daysOverdue: -5, bucket: "current", balanceDue: "3894000" }),
  bill({ id: "csw", billNumber: "CSW-4471", contactId: "coastline", contactName: "Coastline Steel Works", dueDate: "2026-09-09", daysOverdue: 33, balanceDue: "5820000", jobName: "Wing B fit-out" }),
  bill({ id: "kse", billNumber: "KSE-124", contactId: "kaveri", contactName: "Kaveri Sand", dueDate: null, daysOverdue: -1, bucket: "current", balanceDue: "944000", jobName: null }),
];

const vendor = (over: Partial<PayablesVendorRow>): PayablesVendorRow => ({
  contactId: "apex",
  name: "Apex Building Materials",
  billCount: 2,
  overdueAmount: "18054000",
  totalOutstanding: "21948000",
  oldestDaysOverdue: 47,
  oldestDueDate: "2026-08-26",
  credit: "0",
  lastPaidOn: "2026-10-03",
  ...over,
});
const vendors = [vendor({}), vendor({ contactId: "coastline", name: "Coastline Steel Works", billCount: 1, credit: "944000", lastPaidOn: null }), vendor({ contactId: "kaveri", name: "Kaveri Sand", billCount: 1, overdueAmount: "0" })];

describe("US-PUR-56 · see what we owe each vendor", () => {
  it("adds each vendor up over the bills in the age, oldest due first under them", () => {
    const all = vendorView(vendors, bills, { age: null, q: "" });
    expect(all.map((v) => v.contactId)).toEqual(["apex", "coastline", "kaveri"]);
    expect(all[0]).toMatchObject({ billCount: 2, overdueAmount: "18054000", totalOutstanding: "21948000", oldestDaysOverdue: 47, oldestDueDate: "2026-08-26" });
    expect(all[0]!.bills.map((b) => b.id)).toEqual(["late", "soon"]);
    // Only what's due this week: Apex's newer bill; credit and last paid stay the vendor's own.
    const due7 = vendorView(vendors, bills, { age: "due7", q: "" });
    expect(due7).toHaveLength(1);
    expect(due7[0]).toMatchObject({ contactId: "apex", billCount: 1, overdueAmount: "0", totalOutstanding: "3894000", oldestDaysOverdue: -5, lastPaidOn: "2026-10-03" });
    // A vendor whose bills have no due date has no oldest.
    expect(vendorView(vendors, bills, { age: null, q: "kaveri" })[0]).toMatchObject({ oldestDueDate: null, oldestDaysOverdue: -1 });
  });

  it("searches vendors by name on By vendor, and bills by number, vendor or job on By bill", () => {
    expect(vendorView(vendors, bills, { age: null, q: "coast" }).map((v) => v.contactId)).toEqual(["coastline"]);
    expect(filterBills(bills, { age: null, q: "wing b" }).map((b) => b.id)).toEqual(["csw"]);
    expect(filterBills(bills, { age: null, q: "abm-20611" }).map((b) => b.id)).toEqual(["soon"]);
    expect(filterBills(bills, { age: null, q: "kaveri" }).map((b) => b.id)).toEqual(["kse"]);
  });
});

describe("US-PUR-58 · pay from Payables", () => {
  it("pays ticked bills together only when they're from one vendor", () => {
    expect(payBlocked([bills[0]!, bills[1]!])).toBeNull();
    expect(payBlocked([bills[0]!, bills[2]!])).toBe("Pick bills from one vendor — a payment is for one vendor.");
  });
});

describe("US-PUR-59 · filter payables by age and see what's due this week", () => {
  it("knows which bills are in each age; due in 7 days is not yet overdue and has a due date", () => {
    const ids = (age: Parameters<typeof inPayablesAge>[1]) => bills.filter((b) => inPayablesAge(b, age)).map((b) => b.id);
    expect(ids(null)).toEqual(["late", "soon", "csw", "kse"]);
    expect(ids("overdue")).toEqual(["late", "csw"]);
    expect(ids("due7")).toEqual(["soon"]);
    expect(ids("current")).toEqual(["soon", "kse"]);
    expect(ids("31-60")).toEqual(["late", "csw"]);
    expect(inPayablesAge(bill({ dueDate: "2026-10-12", daysOverdue: 0, bucket: "current" }), "due7")).toBe(true);
    expect(inPayablesAge(bill({ dueDate: "2026-10-20", daysOverdue: -8, bucket: "current" }), "due7")).toBe(false);
  });

  it("keeps the age in the address; the dashboard's ?overdue=1 still opens Overdue", () => {
    expect(parsePayablesAge("due7")).toBe("due7");
    expect(parsePayablesAge(null, "1")).toBe("overdue");
    expect(parsePayablesAge("soon")).toBeNull();
    expect(emptyAge("31-60")).toBe("Nothing 31–60 days late.");
    expect(emptyAge("due7")).toBe("Nothing due in the next 7 days.");
  });
});

describe("US-PUR-60 · trust what Payables counts", () => {
  it("keeps tab, age, search, sort and page in the address", () => {
    const state = parsePayablesState(new URLSearchParams("view=bills&age=due7&q=apex&sort=balanceDue.desc&page=2"));
    expect(state).toEqual({ tab: "bill", age: "due7", q: "apex", sort: { key: "balanceDue", direction: "desc" }, page: 2 });
    expect(payablesQuery(state)).toBe("view=bills&age=due7&q=apex&sort=balanceDue.desc&page=2");
    expect(payablesQuery(parsePayablesState(new URLSearchParams("")))).toBe("");
    expect(parsePayablesState(new URLSearchParams("overdue=1")).age).toBe("overdue");
  });

  it("says what drafts it doesn't count", () => {
    expect(draftsNote({ count: 2 }, "₹18,400.00")).toBe("2 draft bills (₹18,400.00) aren't counted here — record them to include them.");
    expect(draftsNote({ count: 1 }, "₹9,200.00")).toBe("1 draft bill (₹9,200.00) isn't counted here — record it to include it.");
    expect(draftsNote({ count: 0 }, "₹0.00")).toBeNull();
  });
});
