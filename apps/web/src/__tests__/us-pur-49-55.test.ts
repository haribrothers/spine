import { describe, expect, it } from "vitest";
import {
  billsPaidLabel,
  filterVendorPayments,
  hasVendorPaymentFilters,
  parseVendorPaymentsState,
  paymentVendors,
  paysSentence,
  spreadOldestFirst,
  vendorPaymentsQuery,
} from "../app/(app)/vendor-payments/vendor-payments-state";
import { vendorPaymentActivityText } from "../app/(app)/vendor-payments/vendor-payment-activity";
import type { VendorPaymentRow } from "../app/(app)/vendor-payments/types";

const row = (over: Partial<VendorPaymentRow>): VendorPaymentRow =>
  ({
    id: "p",
    orgId: "o",
    contactId: "ridgeline",
    contactName: "Ridgeline Equipment Rentals",
    number: "VPY-0014",
    date: "2026-10-11",
    method: "bank_transfer",
    reference: "NEFT 4471",
    currency: "INR",
    amount: "4800000",
    allocatedAmount: "4800000",
    notes: null,
    createdByUserId: null,
    journalEntryId: null,
    createdAt: "2026-10-11T10:12:00Z",
    updatedAt: "2026-10-11T10:12:00Z",
    moneyAccountName: "HDFC Current",
    paidTo: [
      { billId: "b1", number: "RTE-3302" },
      { billId: "b2", number: "RTE-3340" },
    ],
    ...over,
  }) as VendorPaymentRow;

const list = [
  row({ id: "a" }),
  row({ id: "b", contactId: "kaveri", contactName: "Kaveri Sand", number: "VPY-0013", method: "upi", date: "2026-10-09", reference: "UPI 2291", paidTo: [{ billId: "k", number: "KSE-118" }] }),
  row({ id: "c", contactId: "apex", contactName: "Apex Building", number: "VPY-0009", method: "cheque", date: "2026-07-15", reference: null, paidTo: [] }),
];
const now = new Date(2026, 9, 12);

describe("US-PUR-51 · see money paid out at a glance", () => {
  it("filters by vendor, method, date range and search (number, reference, vendor and bills)", () => {
    const base = parseVendorPaymentsState(new URLSearchParams(""));
    const ids = (s: Partial<typeof base>) => filterVendorPayments(list, { ...base, ...s }, now).map((p) => p.id);
    expect(ids({})).toEqual(["a", "b", "c"]);
    expect(ids({ vendor: "kaveri" })).toEqual(["b"]);
    expect(ids({ method: ["upi", "cheque"] })).toEqual(["b", "c"]);
    expect(ids({ range: "this_month" })).toEqual(["a", "b"]);
    expect(ids({ q: "rte-3340" })).toEqual(["a"]);
    expect(ids({ q: "2291" })).toEqual(["b"]);
    expect(ids({ q: "vpy-0009" })).toEqual(["c"]);
  });

  it("keeps the list in the address; the dashboard's contactId link still filters", () => {
    const state = parseVendorPaymentsState(new URLSearchParams("vendor=kaveri&method=upi&range=90&q=sand&sort=amount.desc&page=2"));
    expect(state).toEqual({ q: "sand", vendor: "kaveri", method: ["upi"], range: "90", sort: { key: "amount", direction: "desc" }, page: 2 });
    expect(vendorPaymentsQuery(state)).toBe("vendor=kaveri&method=upi&range=90&q=sand&sort=amount.desc&page=2");
    expect(parseVendorPaymentsState(new URLSearchParams("contactId=apex")).vendor).toBe("apex");
    // `pay=1` opens the dialog instead of filtering.
    expect(parseVendorPaymentsState(new URLSearchParams("contactId=apex&pay=1")).vendor).toBe("");
    expect(hasVendorPaymentFilters(parseVendorPaymentsState(new URLSearchParams("")))).toBe(false);
  });

  it("names the bills paid and lists only vendors with a payment", () => {
    expect(billsPaidLabel([{ number: "RTE-3302" }])).toBe("RTE-3302");
    expect(billsPaidLabel([{ number: "RTE-3302" }, { number: "RTE-3340" }])).toBe("RTE-3302, RTE-3340");
    expect(billsPaidLabel([{ number: "a" }, { number: "b" }, { number: "c" }])).toBe("3 bills");
    expect(paymentVendors(list).map((v) => v.label)).toEqual(["Apex Building", "Kaveri Sand", "Ridgeline Equipment Rentals"]);
  });
});

describe("US-PUR-52 · pay a vendor by ticking bills", () => {
  const money = (v: bigint) => `₹${(Number(v) / 100).toFixed(2)}`;

  it("spreads a typed amount oldest first, each bill up to its balance", () => {
    const bills = [
      { id: "old", balance: 4000000n },
      { id: "mid", balance: 2360000n },
      { id: "new", balance: 1180000n },
    ];
    expect([...spreadOldestFirst(bills, 4800000n)]).toEqual([
      ["old", 4000000n],
      ["mid", 800000n],
    ]);
    expect([...spreadOldestFirst(bills, 10000000n)].map(([, v]) => v)).toEqual([4000000n, 2360000n, 1180000n]);
  });

  it("says what the payment pays, in full or in part", () => {
    const lines = [
      { number: "RTE-3302", amount: 4000000n, balance: 4000000n },
      { number: "RTE-3340", amount: 800000n, balance: 2360000n },
      { number: "RTE-3355", amount: 0n, balance: 1180000n },
    ];
    expect(paysSentence(lines, money)).toBe("₹48000.00 pays RTE-3302 in full and ₹8000.00 of RTE-3340.");
    expect(paysSentence([{ number: "KSE-121", amount: 1240000n, balance: 1240000n }], money)).toBe("₹12400.00 pays KSE-121 in full.");
    expect(paysSentence([], money)).toBe("");
  });
});

describe("US-PUR-49 · see a vendor payment on its own page", () => {
  it("says what each Activity entry was", () => {
    const at = "2026-10-11T10:12:00Z";
    expect(vendorPaymentActivityText({ type: "recorded", at, actorName: "Priya", amount: "4800000", method: "bank_transfer", account: "HDFC Current" }, "INR").text).toMatch(/^Recorded · .*48,000\.00 by bank transfer from HDFC Current$/);
    expect(vendorPaymentActivityText({ type: "applied", at, actorName: "Priya", amount: "800000", detail: "RTE-3340", linkId: "b2" }, "INR").link).toEqual({ label: "RTE-3340", href: "/vendor-bills/b2" });
    expect(vendorPaymentActivityText({ type: "remittance_emailed", at, actorName: "Priya", detail: "accounts@ridgeline.example" }, "INR").text).toBe("Remittance advice emailed to accounts@ridgeline.example");
  });
});
