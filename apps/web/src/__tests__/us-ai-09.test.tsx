import { describe, expect, it } from "vitest";
import { aiCategoryFromMerchant, type ReceiptSuggestion } from "@spine/shared";
import { planExpenseFill, receiptTaxNote, type ExpenseField } from "../app/(app)/expenses/expense-ai-fill";

const diesel: ReceiptSuggestion = {
  merchant: "HP Fuel Centre",
  description: "HP Fuel Centre — HSD diesel, 52.4 L",
  date: "2026-10-13",
  currency: "INR",
  amount: "485000",
  taxAmount: "73983",
  taxPercent: 18,
  taxRateId: "igst18",
  taxLines: [
    { name: "CGST 9%", amount: "36992" },
    { name: "SGST 9%", amount: "36991" },
  ],
  categoryId: "fuel",
  categoryFrom: "merchant",
  merchantExpenses: 3,
  readMs: 3100,
  readAsImages: true,
};

const fresh = { categoryId: "", date: new Date("2026-10-18"), currency: "USD", amount: 0n, taxRateId: "", taxAmount: 0n, description: "" };

describe("US-AI-09", () => {
  it("fills Date, Amount, Currency, Tax rate and Tax amount, Category and Description on a new expense", () => {
    const plan = planExpenseFill(fresh, new Set(), diesel);
    expect(plan.values).toEqual({ categoryId: "fuel", date: new Date("2026-10-13"), currency: "INR", amount: 485000n, taxRateId: "igst18", taxAmount: 73983n, description: "HP Fuel Centre — HSD diesel, 52.4 L" });
    expect(plan.filled).toEqual(["category", "date", "currency", "amount", "taxRate", "taxAmount", "description"]);
    expect(plan.kept).toEqual({});
  });

  it("leaves the tax to the category's rate when the receipt shows none", () => {
    const plan = planExpenseFill(fresh, new Set(), { ...diesel, taxAmount: null, taxRateId: null, taxPercent: null, taxLines: [] });
    expect(plan.values.taxRateId).toBeUndefined();
    expect(plan.values.taxAmount).toBeUndefined();
    expect(plan.filled).not.toContain("taxAmount");
  });

  it("on a rejected expense being fixed, fills only empty fields and offers the rest", () => {
    const entered = new Set<ExpenseField>(["category", "date", "currency", "amount"]);
    const plan = planExpenseFill({ ...fresh, categoryId: "materials", date: new Date("2026-10-13"), currency: "INR", amount: 480000n }, entered, diesel);
    expect(Object.keys(plan.values)).toEqual(["taxRateId", "taxAmount", "description"]);
    expect(plan.kept).toEqual({ categoryId: "fuel", amount: 485000n });
  });

  it("says where the category and the tax came from", () => {
    expect(aiCategoryFromMerchant(3, "HP Fuel Centre")).toBe("As on your last 3 expenses from HP Fuel Centre.");
    expect(aiCategoryFromMerchant(1, "Bunnings")).toBe("As on your last expense from Bunnings.");
    expect(receiptTaxNote(diesel, (a) => `₹${(Number(a) / 100).toFixed(2)}`)).toBe("From the receipt: CGST 9% ₹369.92 + SGST 9% ₹369.91.");
  });
});
