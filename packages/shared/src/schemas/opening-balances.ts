import { z } from "zod";

/**
 * US-RPT-16–US-RPT-19 (D-137) — the balances a business brings into Spine on
 * its cutover date. Receivables, retention, payables and customer advances
 * come from opening documents; every other account is entered here; the
 * difference sits in 3900 Opening Balance Adjustments.
 */

/** Accounts never entered on the grid (I15): their balances come from opening documents, or are the difference. */
export const OPENING_FROM_DOCUMENTS = ["1100", "1150", "2000", "2200"] as const;
export const OPENING_ADJUSTMENTS_CODE = "3900";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-07-01.");
const amount = z.coerce.bigint().nonnegative("Amounts can't be negative.");

export const saveOpeningBalancesSchema = z.object({
  cutoverDate: isoDate,
  lines: z
    .array(z.object({ accountId: z.string().uuid(), debit: amount.default(0n), credit: amount.default(0n) }))
    .refine((lines) => lines.every((l) => l.debit === 0n || l.credit === 0n), { message: "Enter a debit or a credit for an account, not both." })
    .refine((lines) => new Set(lines.map((l) => l.accountId)).size === lines.length, { message: "Enter each account once." })
    .default([]),
});
export type SaveOpeningBalancesInput = z.infer<typeof saveOpeningBalancesSchema>;

export const OPENING_LOCKED = "Unlock the opening balances to change them.";
export const OPENING_DOCUMENTS_BEFORE = (n: number, earliest: string) =>
  `${n} documents are dated before the cutover date. Pick a date on or before ${earliest}, or move those documents.`;
export const OPENING_ADJUSTMENT_NOTE = "Your old books didn't balance, or a figure is missing. The difference sits in Opening Balance Adjustments until you fix it.";
export const OPENING_INTRO = "Bring in what your business had on the day you start using Spine. Your old software's trial balance on that date has every figure you need.";

export type OpeningBalancesStatus = "not_started" | "draft" | "locked";

export interface OpeningBalanceAccountRow {
  accountId: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  /** Minor units as strings; "0" when nothing was entered. */
  debit: string;
  credit: string;
  /** Read-only rows (1100, 1150, 2000, 2200): their balance from opening documents. */
  fromDocuments: { label: string; debit: string; credit: string } | null;
}

export interface OpeningBalancesView {
  status: OpeningBalancesStatus;
  /** The saved cutover date, or the start of the current financial year before the first save. */
  cutoverDate: string;
  /** The day before the cutover date, which every opening entry is dated. */
  balancesAsOf: string;
  lockedAt: string | null;
  accounts: OpeningBalanceAccountRow[];
  /** Grid and document totals together. */
  totalDebit: string;
  totalCredit: string;
  /** Debits less credits: what sits in 3900 Opening Balance Adjustments (as a credit when positive). */
  adjustment: string;
}

/** The day before a `YYYY-MM-DD` date. */
export function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
