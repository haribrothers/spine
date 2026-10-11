import { describe, expect, it } from "vitest";
import type { CustomerRefund } from "@spine/shared";
import { paymentRefundsThisMonth, paymentStats } from "../app/(app)/payments/payments-list-state";
import { paymentState } from "../app/(app)/payments/payment-detail";
import { payment } from "./payment-fixtures";

const now = new Date(2026, 9, 11, 12);

describe("US-PAY-21 · see money received at a glance", () => {
  it("Received this month counts this month's payments; Credit to use sums the credit left and counts customers", () => {
    const list = [
      payment({ id: "a", amount: "4500000" }),
      payment({ id: "b", amount: "20000000", unallocatedAmount: "3800000", contactId: "c2" }),
      payment({ id: "c", date: "2026-09-24", amount: "124000000", unallocatedAmount: "15000000", contactId: "c3" }),
      payment({ id: "d", amount: "100", currency: "USD" }),
    ];
    const { received, credit } = paymentStats(list, "INR", now);
    expect(received).toEqual({ count: 3, amount: 24500000n, otherCurrencies: true });
    expect(credit).toEqual({ count: 2, amount: 18800000n, otherCurrencies: false });
  });

  it("Refunded this month counts refunds of payment credit, not credit notes' or deleted ones", () => {
    const refund = (o: Partial<CustomerRefund>): CustomerRefund => ({ id: "r", contactId: "c1", contactName: "X", source: { kind: "payment", id: "p1", number: "RCP-1" }, moneyAccount: { id: "a", name: "Bank" }, amount: "590000", currency: "INR", date: "2026-10-03", method: "upi", reference: null, deletedAt: null, ...o });
    const sum = paymentRefundsThisMonth([refund({}), refund({ source: { kind: "credit_note", id: "n", number: "CRN-1" } }), refund({ deletedAt: "2026-10-04" }), refund({ date: "2026-09-30" })], "INR", now);
    expect(sum).toEqual({ count: 1, amount: 590000n, otherCurrencies: false });
  });

  it("a payment is Credit left while credit is left, Refunded when it was paid back, else Fully applied", () => {
    expect(paymentState({ unallocatedAmount: "100", refundedAmount: "0" })).toBe("credit");
    expect(paymentState({ unallocatedAmount: "0", refundedAmount: "500" })).toBe("refunded");
    expect(paymentState({ unallocatedAmount: "0", refundedAmount: "0" })).toBe("applied");
  });
});
