import { describe, expect, it } from "vitest";
import { dueNote, invoiceState, paidShare } from "../app/(app)/invoices/invoices-list-state";
import { invoice } from "./invoice-fixtures";

const now = new Date(2026, 9, 10, 12);

describe("US-INV-29 · read each invoice's state in one place", () => {
  it("gives each row one status", () => {
    expect(invoiceState(invoice({ status: "draft" }))).toBe("draft");
    expect(invoiceState(invoice({ status: "void" }))).toBe("void");
    expect(invoiceState(invoice({ balanceDue: "0", paymentStatus: "paid" }))).toBe("paid");
    expect(invoiceState(invoice({ isOverdue: true, paymentStatus: "partially_paid", balanceDue: "10" }))).toBe("overdue");
    expect(invoiceState(invoice({ paymentStatus: "partially_paid", balanceDue: "10" }))).toBe("part_paid");
    expect(invoiceState(invoice({}))).toBe("due");
  });

  it("says when it's due, how overdue it is, or when it was paid", () => {
    expect(dueNote(invoice({ dueDate: "2026-10-12" }), now, "en-GB")).toEqual({ text: "in 2 days", tone: "soon" });
    expect(dueNote(invoice({ dueDate: "2026-10-10" }), now, "en-GB")).toEqual({ text: "today", tone: "soon" });
    expect(dueNote(invoice({ dueDate: "2026-11-09" }), now, "en-GB")).toEqual({ text: "in 30 days", tone: "" });
    expect(dueNote(invoice({ dueDate: "2026-10-04", isOverdue: true }), now, "en-GB")).toEqual({ text: "Overdue 6 days", tone: "over" });
    expect(dueNote(invoice({ balanceDue: "0", paymentStatus: "paid", lastPaidAt: "2026-10-02" }), now, "en-GB")).toEqual({ text: "Paid 2 Oct", tone: "paid" });
    expect(dueNote(invoice({ status: "void" }), now, "en-GB").text).toBe("");
  });

  it("shows how much of what's due is paid, leaving retention out", () => {
    expect(paidShare(invoice({ totalAmount: "110000", retentionAmount: "10000", balanceDue: "25000" }))).toBe(75);
    expect(paidShare(invoice({ balanceDue: "100000" }))).toBe(0);
    expect(paidShare(invoice({ balanceDue: "0" }))).toBe(100);
  });
});
