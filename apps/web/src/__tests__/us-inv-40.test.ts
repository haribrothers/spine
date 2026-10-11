import { describe, expect, it } from "vitest";
import type { CustomerRefund } from "@spine/shared";
import { creditNoteState, creditNoteStats, refundedThisMonth, whereItWent } from "../app/(app)/credit-notes/credit-notes-list-state";
import { creditNote } from "./credit-note-fixtures";

const now = new Date(2026, 9, 11, 12);

describe("US-INV-40 · see where each credit went, at a glance", () => {
  it("says where a credit note's money went", () => {
    expect(whereItWent(creditNote({})).map((p) => p.text)).toEqual(["Off INV-0041"]);
    const mixed = creditNote({ offInvoiceAmount: "4161600", appliedAmount: "1000000", creditRemainingAmount: "785600" });
    expect(whereItWent(mixed).map((p) => p.kind)).toEqual(["off", "applied", "left"]);
    expect(whereItWent(mixed).map((p) => p.text)[2]).toMatch(/7,856\.00 left$/);
    expect(whereItWent(creditNote({ offInvoiceAmount: "0", refundedAmount: "590000" })).map((p) => p.kind)).toEqual(["refunded"]);
    expect(whereItWent(creditNote({ status: "draft" }))).toEqual([]);
    expect(creditNoteState(creditNote({ creditRemainingAmount: "100" }))).toBe("credit_left");
    expect(creditNoteState(creditNote({}))).toBe("credited");
  });

  it("totals what was credited this month and the credit customers still hold, per customer", () => {
    const list = [
      creditNote({ number: "A", totalAmount: "2360000", issuedAt: "2026-10-09T05:30:00Z" }),
      creditNote({ number: "B", totalAmount: "590000", issuedAt: "2026-10-07T05:30:00Z", creditRemainingAmount: "785600" }),
      creditNote({ number: "C", totalAmount: "11800000", issuedAt: "2026-09-02T05:30:00Z", contactId: "c2", creditRemainingAmount: "4880000" }),
      creditNote({ number: "D", totalAmount: "1000", issuedAt: "2026-10-01T05:30:00Z", currency: "USD" }),
      creditNote({ status: "draft", totalAmount: "99999", issuedAt: null }),
    ];
    const stats = creditNoteStats(list, "INR", now);
    expect(stats.credited).toEqual({ count: 3, amount: 2950000n, otherCurrencies: true });
    expect(stats.toUse).toEqual({ count: 2, amount: 5665600n, otherCurrencies: false });
  });

  it("counts refunds of credit-note credit dated this month, leaving out deleted ones and payment refunds", () => {
    const refund = (over: Partial<CustomerRefund>): CustomerRefund =>
      ({ id: "r", contactId: "c1", contactName: "x", source: { kind: "credit_note", id: "c", number: "CRN-1" }, moneyAccount: { id: "m", name: "Bank" }, amount: "590000", currency: "INR", date: "2026-10-08", method: "upi", reference: null, deletedAt: null, ...over }) as CustomerRefund;
    const sum = refundedThisMonth([refund({}), refund({ deletedAt: "2026-10-09T00:00:00Z" }), refund({ source: { kind: "payment", id: "p", number: "RCP-1" } }), refund({ date: "2026-09-30" })], "INR", now);
    expect(sum).toEqual({ count: 1, amount: 590000n, otherCurrencies: false });
  });
});
