import { z } from "zod";
import { unknownPlaceholder, unknownPlaceholderMessage } from "./email-templates.ts";

/**
 * US-PAY-14/15 — customer statements: every invoice, payment and credit
 * for one customer over a period, with the balance due. Derived from the
 * customer's Accounts Receivable journal lines (D-011); nothing is stored.
 */

export type StatementPeriod = "last_30" | "last_90" | "this_year" | "custom";
export type StatementMode = "open" | "all";

export const STATEMENT_PERIOD_OPTIONS: { value: StatementPeriod; label: string }[] = [
  { value: "last_30", label: "Last 30 days" },
  { value: "last_90", label: "Last 90 days" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom" },
];

export const STATEMENT_MODE_OPTIONS: { value: StatementMode; label: string }[] = [
  { value: "open", label: "Open invoices only" },
  { value: "all", label: "All activity" },
];

export const NO_INVOICES_YET = "No invoices for this customer yet.";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The dates a preset covers, ending `today` (`YYYY-MM-DD`). "Last 30 days" is the 30 days up to and including today. */
export function statementPeriodRange(period: Exclude<StatementPeriod, "custom">, today: string): { from: string; to: string } {
  if (period === "this_year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: addDays(today, period === "last_30" ? -29 : -89), to: today };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");

/** `GET /contacts/:id/statement` and `statement.pdf` query. */
export const statementQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    mode: z.enum(["open", "all"]).default("all"),
  })
  .refine((q) => q.from <= q.to, { message: "Pick an end date after the start date.", path: ["to"] });

/** `POST /contacts/:id/statement/send`. */
export const sendStatementSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    mode: z.enum(["open", "all"]).default("all"),
    email: z.string().trim().email("Enter an email address to send the statement to."),
    message: z.string().trim().max(20000, "Keep the message shorter.").optional().nullable(),
    /** US-SET-21 — the subject, when the dialog changed it from the "Statement" template. */
    subject: z.string().trim().min(1, "Enter a subject.").max(200, "Keep the subject under 200 characters.").optional().nullable(),
  })
  .refine((q) => q.from <= q.to, { message: "Pick an end date after the start date.", path: ["to"] })
  .superRefine((q, ctx) => {
    for (const field of ["subject", "message"] as const) {
      const name = q[field] ? unknownPlaceholder(q[field]!, "statement") : null;
      if (name !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: unknownPlaceholderMessage(name) });
    }
  });

export type StatementQuery = z.infer<typeof statementQuerySchema>;
export type SendStatementInput = z.infer<typeof sendStatementSchema>;

export interface StatementRow {
  /** `YYYY-MM-DD` */
  date: string;
  /** INV-0006, RCP-0004, CN-0002 */
  reference: string | null;
  /** "Invoice", "Payment", "Credit note", "Invoice voided", … */
  type: string;
  /** Minor units as strings; "0" when the row has none. */
  charges: string;
  payments: string;
  balance: string;
}

export interface StatementAging {
  current: string;
  "1-30": string;
  "31-60": string;
  "61-90": string;
  "90+": string;
}

export interface Statement {
  contactId: string;
  contactName: string;
  contactEmail: string | null;
  contactAddress: string | null;
  currency: string;
  from: string;
  to: string;
  mode: StatementMode;
  /** AR balance before `from`. */
  openingBalance: string;
  /** Charges and payments/credits in the period (all activity). */
  invoiced: string;
  paidAndCredited: string;
  /** What's owed: the AR balance at `to` (all activity) or the open invoices' balances (open only). */
  balanceDue: string;
  rows: StatementRow[];
  aging: StatementAging;
  /** False when the customer has never been invoiced; sending is then disabled. */
  hasInvoices: boolean;
}
