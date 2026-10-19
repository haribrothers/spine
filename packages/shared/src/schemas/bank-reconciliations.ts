import { z } from "zod";
import type { MoneyAccountKind } from "./banking.ts";
import type { StatementLine } from "./bank-statements.ts";
import type { AiBankSuggestions } from "./ai.ts";

/**
 * US-BANK-08–US-BANK-11 (D-158, D-176) — reconciling a money account to a
 * bank statement. Amounts follow the statement-line convention: money in
 * (or a card payment) is positive, like a debit. Balances are in the
 * account's own sense, so a card's balance is what's owed.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-05.");

/** `POST /bank-reconciliations` — starts one, or updates the one already in progress for the account. */
export const startReconciliationSchema = z.object({
  moneyAccountId: z.string().uuid("Choose the account."),
  statementEndDate: isoDate,
  statementClosingBalance: z.coerce.bigint(),
});
export type StartReconciliationInput = z.infer<typeof startReconciliationSchema>;

/** US-AI-14 — who suggested a match: the rules ("Match all suggested"), AI, or the person by hand. */
export const MATCH_SUGGESTED_BY = ["rules", "ai", "person"] as const;
export type MatchSuggestedBy = (typeof MATCH_SUGGESTED_BY)[number];

/** `PUT /bank-reconciliations/:id/matches` — the whole set of matches and exclusions, saved as the person goes. */
export const saveReconciliationMatchesSchema = z.object({
  matches: z
    .array(
      z.object({
        statementLineId: z.string().uuid(),
        journalLineIds: z.array(z.string().uuid()).min(1, "Tick the entries that make up this line."),
        suggestedBy: z.enum(MATCH_SUGGESTED_BY).default("person"),
      }),
    )
    .default([]),
  exclusions: z
    .array(
      z.object({
        statementLineId: z.string().uuid(),
        note: z
          .string()
          .trim()
          .max(200, "Use 200 characters or fewer for the note.")
          .optional()
          .transform((v) => v ?? ""),
      }),
    )
    .default([]),
});
export type SaveReconciliationMatchesInput = z.infer<typeof saveReconciliationMatchesSchema>;

export const reconciliationListQuerySchema = z.object({
  moneyAccountId: z.string().uuid(),
  status: z.enum(["in_progress", "finished", "undone"]).optional(),
});

export const MATCH_SUM_MISMATCH = (entries: string, line: string) => `Selected entries add up to ${entries}; the line is ${line}.`;
export const DIFFERENCE_NOT_ZERO = (difference: string) => `Difference ${difference} — match or create entries until it's zero.`;
export const RECONCILED_ENTRY_LOCKED = (account: string, date: string) => `This entry is part of a finished reconciliation of ${account} to ${date}. Undo that reconciliation first.`;
export const UNDO_LATER_FIRST = "Undo the later reconciliations first.";
export const RECONCILE_AFTER = (date: string) => `Choose a date after ${date}, when this account was last reconciled.`;

/** An entry on the account that a statement line can match. */
export interface ReconciliationEntry {
  journalLineId: string;
  date: string;
  sourceType: string;
  sourceId: string;
  what: string;
  contact: { id: string; name: string } | null;
  reference: string | null;
  /** Minor units as a string; money in is positive. */
  amount: string;
  /** The statement line it's matched to in this reconciliation, if any. */
  statementLineId: string | null;
}

export interface ReconciliationSummary {
  id: string;
  moneyAccountId: string;
  status: "in_progress" | "finished" | "undone";
  statementEndDate: string;
  statementClosingBalance: string;
  entriesMatched: number;
  finishedBy: { id: string; name: string } | null;
  finishedAt: string | null;
  /** Only the most recent finished reconciliation of an account can be undone. */
  isLatest: boolean;
}

export interface ReconciliationView extends ReconciliationSummary {
  moneyAccount: { id: string; name: string; kind: MoneyAccountKind };
  /** The last finished reconciliation's closing balance, or Spine's balance brought forward (D-176). */
  openingBalance: string;
  /** For an account's first reconciliation: entries before this date make up the opening balance. */
  broughtForwardBefore: string | null;
  lastReconciledOn: string | null;
  statementLines: StatementLine[];
  /** Unreconciled entries up to the end date, including those matched here. */
  entries: ReconciliationEntry[];
  matches: { statementLineId: string; journalLineIds: string[]; suggestedBy: MatchSuggestedBy }[];
  /** One entry of the same amount within 3 days of an unmatched line (D-158). */
  suggestions: { statementLineId: string; journalLineId: string }[];
  /** US-AI-14 — AI's last suggestions, for lines still unmatched; null until someone asks. */
  aiSuggestions: AiBankSuggestions | null;
  matchedCount: number;
  clearedBalance: string;
  difference: string;
  fileNames: string[];
  /**
   * US-BANK-17 — entries in Spine up to the end date that aren't on the
   * statement: still unmatched here, or (once finished) matched only by a
   * later reconciliation. Amounts as `entries`'.
   */
  outstanding: ReconciliationEntry[];
  /** Spine's balance of the account on the end date, in the account's own sense. */
  spineBalance: string;
  /** Excluded statement lines, in the account's own sense (they're on the statement, not in the books). */
  excludedTotal: string;
}
