import { z } from "zod";

/**
 * US-RPT-26 — the cash flow statement, indirect method, read from
 * `journal_lines`. Sections follow the glossary's "Cash flow sections":
 * bank and cash money accounts are the cash; card accounts and working
 * capital are Operating; fixed assets (1500–1999) Investing; equity and
 * loans (2500–2999) Financing.
 */
export const cashFlowQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30."),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30."),
});

export type CashFlowSectionKey = "operating" | "investing" | "financing";

export interface CashFlowAccount {
  id: string;
  code: string;
  name: string;
  /** Minor units; positive brings cash in. */
  amount: string;
}

export interface CashFlowLine {
  key: string;
  label: string;
  /** Minor units; positive brings cash in. */
  amount: string;
  /** The accounts behind the line, for the drill-down. */
  accounts: CashFlowAccount[];
}

export interface CashFlowSection {
  key: CashFlowSectionKey;
  label: string;
  totalLabel: string;
  lines: CashFlowLine[];
  total: string;
}

export interface CashFlowReport {
  from: string;
  to: string;
  cashAtStart: string;
  sections: CashFlowSection[];
  netChange: string;
  cashAtEnd: string;
  /** The bank and cash accounts that make up "cash", with their balances on `to`. */
  cashAccounts: CashFlowAccount[];
  /** Cash at start plus the net change equals the bank and cash balances on `to`; false is logged as an error. */
  ties: boolean;
}
