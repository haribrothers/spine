import { describe, expect, it } from "vitest";
import { invoiceStats, paidThisMonth } from "../app/(app)/invoices/invoices-list-state";
import { invoice } from "./invoice-fixtures";

const now = new Date(2026, 9, 10, 12);

describe("US-INV-27 · see what's owed, overdue and due this week at a glance", () => {
  it("sums balances of issued invoices still owed, in the business's currency, leaving out drafts, voids and paid ones", () => {
    const list = [
      invoice({ number: "INV-1", balanceDue: "100000", dueDate: "2026-10-30" }),
      invoice({ number: "INV-2", balanceDue: "40000", dueDate: "2026-10-01", isOverdue: true }),
      invoice({ number: "INV-3", balanceDue: "25000", dueDate: "2026-10-14" }),
      invoice({ number: "INV-4", balanceDue: "9000", dueDate: "2026-10-12", currency: "USD" }),
      invoice({ number: "INV-5", balanceDue: "0", paymentStatus: "paid" }),
      invoice({ status: "draft", balanceDue: "70000" }),
      invoice({ number: "INV-6", status: "void", balanceDue: "70000" }),
    ];
    const stats = invoiceStats(list, "INR", now);
    expect(stats.outstanding).toEqual({ count: 4, amount: 165000n, otherCurrencies: true });
    expect(stats.overdue).toEqual({ count: 1, amount: 40000n, otherCurrencies: false });
    // Due in 7 days: today to 17 Oct, not overdue.
    expect(stats.due7).toEqual({ count: 2, amount: 25000n, otherCurrencies: true });
  });

  it("counts payments dated this month that paid invoices", () => {
    const sum = paidThisMonth(
      [
        { date: "2026-10-02", currency: "INR", allocatedAmount: "50000" },
        { date: "2026-10-09", currency: "INR", allocatedAmount: "12000" },
        { date: "2026-09-30", currency: "INR", allocatedAmount: "99999" },
        { date: "2026-10-05", currency: "INR", allocatedAmount: "0" },
        { date: "2026-10-06", currency: "USD", allocatedAmount: "3000" },
      ],
      "INR",
      now,
    );
    expect(sum).toEqual({ count: 3, amount: 62000n, otherCurrencies: true });
  });
});
