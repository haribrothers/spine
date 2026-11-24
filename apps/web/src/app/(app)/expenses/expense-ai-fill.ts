import type { ReceiptSuggestion } from "@spine/shared";
import { t } from "../../../lib/i18n";

/** The expense form's fields AI can fill (US-AI-09). */
export type ExpenseField = "category" | "date" | "currency" | "amount" | "taxRate" | "taxAmount" | "description";

export interface ExpenseValues {
  categoryId: string;
  date: Date | undefined;
  currency: string;
  amount: bigint;
  taxRateId: string;
  taxAmount: bigint;
  description: string;
}

const FIELD_OF: Record<keyof ExpenseValues, ExpenseField> = { categoryId: "category", date: "date", currency: "currency", amount: "amount", taxRateId: "taxRate", taxAmount: "taxAmount", description: "description" };

const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || v === 0n;
const same = (a: unknown, b: unknown) => (a instanceof Date && b instanceof Date ? a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10) : a === b);

/** What a receipt suggests for each field — the tax only when the receipt shows it (otherwise the category's rate applies, US-PUR-48). */
export function receiptValues(suggestion: ReceiptSuggestion): Partial<ExpenseValues> {
  return {
    categoryId: suggestion.categoryId ?? undefined,
    date: suggestion.date ? new Date(suggestion.date) : undefined,
    currency: suggestion.currency ?? undefined,
    amount: suggestion.amount ? BigInt(suggestion.amount) : undefined,
    taxRateId: suggestion.taxAmount !== null ? (suggestion.taxRateId ?? undefined) : undefined,
    taxAmount: suggestion.taxAmount !== null ? BigInt(suggestion.taxAmount) : undefined,
    description: suggestion.description ?? undefined,
  };
}

/**
 * The shared rules for the expense form (D-242) — AI fills what the person
 * hasn't entered (today's date and the default currency aren't entries) and
 * offers the rest as "Replace my entries (<n>)". Run on the values as they
 * are when the answer arrives (US-AI-07).
 */
export function planExpenseFill(current: ExpenseValues, entered: ReadonlySet<ExpenseField>, suggestion: ReceiptSuggestion): { values: Partial<ExpenseValues>; filled: ExpenseField[]; kept: Partial<ExpenseValues> } {
  const read = receiptValues(suggestion);
  const values: Partial<ExpenseValues> = {};
  const kept: Partial<ExpenseValues> = {};
  const filled: ExpenseField[] = [];
  for (const key of Object.keys(read) as (keyof ExpenseValues)[]) {
    const value = read[key];
    if (value === undefined) continue;
    const field = FIELD_OF[key];
    if (!entered.has(field) || isEmpty(current[key])) {
      (values as Record<string, unknown>)[key] = value;
      filled.push(field);
    } else if (!same(current[key], value)) {
      (kept as Record<string, unknown>)[key] = value;
    }
  }
  return { values, filled, kept };
}

/** "From the receipt: CGST ₹369.92 + SGST ₹369.91." */
export function receiptTaxNote(suggestion: ReceiptSuggestion, format: (amount: bigint) => string): string {
  return suggestion.taxLines.length ? t("expenses.aiFill.taxNote", { lines: suggestion.taxLines.map((l) => `${l.name} ${format(BigInt(l.amount))}`).join(" + ") }) : t("expenses.aiFill.taxNoteEmpty");
}
