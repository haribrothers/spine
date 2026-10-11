import { describe, expect, it } from "vitest";
import { spreadCreditAmount } from "@spine/shared";
import { creditNoteLines } from "../app/(app)/invoices/create-credit-note-dialog";
import type { Creditable } from "../app/(app)/invoices/types";

const creditable: Creditable = {
  invoiceId: "i1",
  invoiceNumber: "INV-0041",
  currency: "INR",
  balanceDue: "4161600",
  leftToCredit: "46161600",
  lines: [
    { invoiceLineId: "a", position: 1, name: "Storm-water drainage", description: null, quantity: 1, creditedQuantity: 0, leftQuantity: 1, unitPriceAmount: "24000000", taxRatePercentage: 18, hsnSac: "995411", lineTotalAmount: "28320000", leftAmount: "28320000" },
    { invoiceLineId: "b", position: 2, name: "Loading bay canopy", description: null, quantity: 36, creditedQuantity: 0, leftQuantity: 36, unitPriceAmount: "420000", taxRatePercentage: 18, hsnSac: "995411", lineTotalAmount: "17841600", leftAmount: "17841600" },
    { invoiceLineId: "c", position: 3, name: "Site supervision", description: null, quantity: 24, creditedQuantity: 24, leftQuantity: 0, unitPriceAmount: "250000", taxRatePercentage: 18, hsnSac: null, lineTotalAmount: "7080000", leftAmount: "0" },
  ],
};

describe("US-INV-36 · credit an invoice's lines, with their tax", () => {
  it("credits the ticked lines and how many of each", () => {
    expect(creditNoteLines(creditable, "lines", { a: "1", b: "12" }, new Set(["b"]), 0n)).toEqual([{ invoiceLineId: "b", quantity: 12, name: "Loading bay canopy" }]);
    // Nothing ticked, or a quantity of nothing: nothing to issue.
    expect(creditNoteLines(creditable, "lines", { b: "0" }, new Set(["b"]), 0n)).toBeNull();
    expect(creditNoteLines(creditable, "lines", {}, new Set(), 0n)).toBeNull();
  });

  it("spreads an amount over the lines by what's left on each, the parts adding up exactly", () => {
    const lines = creditNoteLines(creditable, "amount", {}, new Set(), 5000000n);
    expect(lines).toEqual([
      { invoiceLineId: "a", creditAmount: "3067484", name: "Storm-water drainage" },
      { invoiceLineId: "b", creditAmount: "1932516", name: "Loading bay canopy" },
    ]);
    expect(creditNoteLines(creditable, "amount", {}, new Set(), 50000000n)).toBe("too-much");
  });

  it("never gives a line more than it has left, and hands the pennies over to the last lines", () => {
    expect(spreadCreditAmount([100n, 100n, 100n], 100n)).toEqual([33n, 33n, 34n]);
    expect(spreadCreditAmount([1n, 0n, 1000n], 1001n)).toEqual([1n, 0n, 1000n]);
    expect(spreadCreditAmount([0n, 0n], 0n)).toEqual([0n, 0n]);
  });
});
