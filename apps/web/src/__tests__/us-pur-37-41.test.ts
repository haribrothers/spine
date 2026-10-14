import { describe, expect, it } from "vitest";
import { creditState, creditStats, creditUse, fillBills, filterCredits, parseVendorCreditsState, vendorCreditsQuery } from "../app/(app)/vendor-credits/vendor-credit-state";
import { creditActivityText } from "../app/(app)/vendor-credits/vendor-credit-activity";
import type { VendorCredit } from "../app/(app)/vendor-credits/types";

const today = new Date(2026, 9, 11);
const credit = (over: Partial<VendorCredit>): VendorCredit =>
  ({
    id: "c",
    number: "VCR-0007",
    vendorReference: "CN-77",
    contactId: "v1",
    contactName: "Ridgeline Equipment Rentals",
    placeOfSupply: null,
    supplyType: null,
    billId: null,
    billNumber: null,
    jobId: null,
    jobName: null,
    date: "2026-10-03",
    status: "open",
    currency: "INR",
    subtotalAmount: "1500000",
    taxAmount: "270000",
    totalAmount: "1770000",
    balanceAmount: "1770000",
    notes: null,
    voidReason: null,
    createdByUserId: null,
    ...over,
  }) as VendorCredit;

describe("US-PUR-37 · see where a vendor credit stands", () => {
  it("says where a credit stands in words; Partly used is worked out, never stored", () => {
    expect(creditState(credit({ status: "draft" }))).toBe("draft");
    expect(creditState(credit({ status: "void", balanceAmount: "0" }))).toBe("void");
    expect(creditState(credit({}))).toBe("open");
    expect(creditState(credit({ balanceAmount: "778800" }))).toBe("partly");
    expect(creditState(credit({ status: "used", balanceAmount: "0" }))).toBe("used");
  });

  it("adds up what's applied and refunded, leaving out deleted refunds", () => {
    const use = creditUse({
      allocations: [{ id: "a", billId: "b", billNumber: "RPH-8790", amount: "991200", createdAt: "2026-10-04T00:00:00Z" }],
      refunds: [
        { id: "r1", amount: "10000", date: "2026-10-05", method: "bank_transfer", reference: null, deletedAt: null, moneyAccountName: "HDFC" },
        { id: "r2", amount: "5000", date: "2026-10-06", method: "cash", reference: null, deletedAt: "2026-10-07T00:00:00Z", moneyAccountName: "Cash" },
      ],
    });
    expect(use).toEqual({ applied: 991200n, refunded: 10000n });
  });

  it("says what each Activity entry was", () => {
    const at = "2026-10-04T05:50:00Z";
    expect(creditActivityText({ type: "recorded", at, actorName: "Priya", amount: "1770000" }, "INR", "Ridgeline").text).toContain("off what you owe Ridgeline");
    expect(creditActivityText({ type: "applied", at, actorName: "Priya", amount: "991200", detail: "RPH-8790", linkId: "b1" }, "INR", "Ridgeline").link).toEqual({ label: "RPH-8790", href: "/vendor-bills/b1" });
    expect(creditActivityText({ type: "unapplied", at, actorName: "Priya", amount: "5000", detail: "RTE-3302" }, "INR", "Ridgeline").text).toContain("from RTE-3302");
    expect(creditActivityText({ type: "voided", at, actorName: "Priya", detail: "Entered twice" }, "INR", "Ridgeline").after).toBe("Entered twice");
  });
});

describe("US-PUR-38 · see what credit vendors owe us at a glance", () => {
  const credits = [
    credit({ id: "d1", number: null, status: "draft", totalAmount: "354000", balanceAmount: "0", date: "2026-10-10" }),
    credit({ id: "d2", number: null, status: "draft", totalAmount: "590000", balanceAmount: "0", contactId: "v2", contactName: "Kaveri Sand", date: "2026-10-09" }),
    credit({ id: "p", balanceAmount: "778800", billId: "b1", billNumber: "RTE-3302", jobId: "j1", jobName: "Wing C fit-out" }),
    credit({ id: "o", totalAmount: "1072000", balanceAmount: "1072000", date: "2026-09-22" }),
    credit({ id: "old", totalAmount: "1298000", balanceAmount: "1298000", date: "2026-08-04", contactId: "v3", contactName: "Coastline Steel Works" }),
    credit({ id: "used", status: "used", totalAmount: "472000", balanceAmount: "0", date: "2026-07-18" }),
    credit({ id: "void", status: "void", totalAmount: "826000", balanceAmount: "0", date: "2026-07-02" }),
    credit({ id: "usd", currency: "USD", date: "2026-07-01" }),
  ];

  it("adds up Credit to use, Drafts, Partly used and Unused 60+ days in the business's currency", () => {
    const stats = creditStats(credits, "INR", today);
    expect(stats.toUse).toEqual({ amount: 778800n + 1072000n + 1298000n, count: 3 });
    expect(stats.drafts).toEqual({ amount: 354000n + 590000n, count: 2 });
    expect(stats.partly).toEqual({ amount: 778800n, count: 1 });
    expect(stats.unused).toEqual({ amount: 1298000n, count: 1 });
  });

  it("filters by card, state, vendor, job and search (number, their number, vendor or bill)", () => {
    const state = parseVendorCreditsState(new URLSearchParams(""));
    const ids = (s: Partial<typeof state>) => filterCredits(credits, { ...state, ...s }, today).map((c) => c.id);
    expect(ids({ card: "drafts" })).toEqual(["d1", "d2"]);
    expect(ids({ card: "partly" })).toEqual(["p"]);
    expect(ids({ card: "unused" })).toEqual(["old", "usd"]);
    expect(ids({ states: ["used", "void"] })).toEqual(["used", "void"]);
    expect(ids({ vendor: "v3" })).toEqual(["old"]);
    expect(ids({ job: "j1" })).toEqual(["p"]);
    expect(ids({ q: "rte-3302" })).toEqual(["p"]);
    expect(ids({ q: "kaveri" })).toEqual(["d2"]);
  });

  it("keeps state, vendor, job, card, search, sort and page in the address", () => {
    const state = parseVendorCreditsState(new URLSearchParams("state=partly,open,bogus&vendor=v1&job=j1&card=unused&q=cn&sort=total.desc&page=2"));
    expect(state).toEqual({ states: ["partly", "open"], vendor: "v1", job: "j1", card: "unused", q: "cn", sort: { key: "total", direction: "desc" }, page: 2 });
    expect(vendorCreditsQuery(state)).toBe("state=partly%2Copen&vendor=v1&job=j1&card=unused&q=cn&sort=total.desc&page=2");
    expect(vendorCreditsQuery(parseVendorCreditsState(new URLSearchParams("")))).toBe("");
  });
});

describe("US-PUR-40 · raise and use a credit from its bill", () => {
  it("fills the bill it was raised against first, then the oldest, up to what's left", () => {
    const bills = [
      { id: "old", date: "2026-08-01", balanceDue: "500" },
      { id: "against", date: "2026-09-25", balanceDue: "4064000" },
      { id: "newer", date: "2026-10-02", balanceDue: "900" },
      { id: "paid", date: "2026-07-01", balanceDue: "0" },
    ];
    const { ordered, amounts } = fillBills(bills, 4064300n, "against");
    expect(ordered.map((b) => b.id)).toEqual(["against", "old", "newer"]);
    expect(amounts).toEqual({ against: 4064000n, old: 300n, newer: 0n });
    expect(fillBills(bills, 1000n, null).ordered.map((b) => b.id)).toEqual(["old", "against", "newer"]);
  });
});
