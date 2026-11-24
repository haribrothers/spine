import { z } from "zod";

/**
 * US-RPT-20–US-RPT-22 (D-134) — adjusting journals for what no document
 * covers. Owner-only to post or reverse; readable with `ledger.view`.
 */

/** Accounts a journal can never touch (I15): they move only through their documents. Retained Earnings (3200) stays usable for year-end entries. */
export const JOURNAL_CONTROL_CODES = ["1100", "1150", "1200", "2000", "2100", "2200", "3900"] as const;

export const JOURNAL_CONTROL_HINT =
  "Accounts Receivable, Retention Receivable, Input Tax, Accounts Payable, Output Tax, Customer Advances and Opening Balance Adjustments aren't offered: use invoices, bills, payments or Record tax payment for those.";
export const JOURNAL_CONTROL_ACCOUNT = (account: string) => `Use invoices, bills, payments or Record tax payment to change ${account}.`;
export const JOURNAL_OUT_BY = (amount: string) => `Debits and credits must be equal — out by ${amount}.`;
export const NO_JOURNALS = "No journals yet. Most businesses only need one for year-end adjustments.";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30.");
const amount = z.coerce.bigint().nonnegative("Amounts can't be negative.");

export const createManualJournalSchema = z.object({
  date: isoDate,
  reason: z.string().trim().min(1, "Enter the reason for this journal.").max(200, "Use 200 characters or fewer for the reason."),
  lines: z
    .array(
      z
        .object({
          accountId: z.string().uuid("Choose an account on every line."),
          description: z
            .string()
            .trim()
            .max(200)
            .optional()
            .nullable()
            .transform((v) => (v ? v : null)),
          debit: amount.default(0n),
          credit: amount.default(0n),
          jobId: z.string().uuid().optional().nullable().transform((v) => v ?? null),
        })
        .refine((l) => (l.debit === 0n) !== (l.credit === 0n), { message: "Enter a debit or a credit on each line, not both." }),
    )
    .min(2, "A journal needs at least two lines."),
});
export type CreateManualJournalInput = z.infer<typeof createManualJournalSchema>;

export const reverseManualJournalSchema = z.object({
  date: isoDate,
  reason: z.string().trim().min(1, "Enter why you're reversing it.").max(200),
});

export type ManualJournalStatus = "posted" | "reversed";

export interface ManualJournalLine {
  id: string;
  account: { id: string; code: string; name: string };
  description: string | null;
  /** Minor units as strings. */
  debit: string;
  credit: string;
  job: { id: string; name: string; number: string | null } | null;
}

export interface ManualJournal {
  id: string;
  number: string;
  date: string;
  reason: string;
  status: ManualJournalStatus;
  /** The total of the debits. */
  total: string;
  postedBy: { id: string; name: string } | null;
  createdAt: string;
  reversal: { date: string; reason: string; by: { id: string; name: string } | null; entryId: string } | null;
  /** On `GET /manual-journals/:id` only. */
  lines?: ManualJournalLine[];
}
