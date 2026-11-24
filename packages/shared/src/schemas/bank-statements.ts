import { z } from "zod";
import { fromDecimalString } from "../money/format.ts";

/**
 * US-BANK-07 (D-157) — importing a bank's CSV statement. The columns are
 * mapped once per money account and saved for the next import. Amounts are
 * signed in the account's own sense: money in (a deposit, or a card payment)
 * is positive, like a journal line's debit.
 */

export const STATEMENT_MAX_ROWS = 5000;
export const STATEMENT_MAX_BYTES = 2 * 1024 * 1024;
export const STATEMENT_TOO_BIG = "Split the statement into smaller files (up to 5,000 lines).";
export const STATEMENT_NOT_CSV = "Export the statement from your bank as CSV, then import it here.";

export const STATEMENT_DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD MMM YYYY"] as const;
export type StatementDateFormat = (typeof STATEMENT_DATE_FORMATS)[number];

const column = z.string().trim().min(1);
const optionalColumn = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

/** Which CSV column holds what. Column names are the file's own headers. */
export const statementMappingSchema = z
  .object({
    date: column,
    dateFormat: z.enum(STATEMENT_DATE_FORMATS),
    description: column,
    reference: optionalColumn,
    amountMode: z.enum(["single", "split"]),
    amount: optionalColumn,
    moneyIn: optionalColumn,
    moneyOut: optionalColumn,
    balance: optionalColumn,
  })
  .refine((m) => (m.amountMode === "single" ? Boolean(m.amount) : Boolean(m.moneyIn && m.moneyOut)), {
    message: "Choose the amount column, or the money in and money out columns.",
    path: ["amount"],
  });
export type StatementMapping = z.infer<typeof statementMappingSchema>;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** A statement date in `format` as `YYYY-MM-DD`, or null when it can't be read. Separators can be / - . or spaces; two-digit years are 20xx. */
export function parseStatementDate(raw: string, format: StatementDateFormat): string | null {
  const value = raw.trim();
  if (!value) return null;
  const parts = value.split(/[\s/.\-,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  let day: number;
  let month: number;
  let year: number;
  if (format === "DD MMM YYYY") {
    const m = MONTHS.indexOf(parts[1]!.slice(0, 3).toLowerCase());
    if (m < 0) return null;
    [day, month, year] = [Number(parts[0]), m + 1, Number(parts[2])];
  } else if (format === "YYYY-MM-DD") {
    [year, month, day] = parts.slice(0, 3).map(Number) as [number, number, number];
  } else if (format === "MM/DD/YYYY") {
    [month, day, year] = parts.slice(0, 3).map(Number) as [number, number, number];
  } else {
    [day, month, year] = parts.slice(0, 3).map(Number) as [number, number, number];
  }
  if (![day, month, year].every(Number.isInteger)) return null;
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * A statement amount in minor units, or null when it can't be read. Accepts
 * currency symbols, thousands separators, a leading or trailing minus, the
 * true minus sign, brackets for negatives, and a "CR"/"DR" suffix. An empty
 * cell is null too; the caller decides whether that's 0.
 */
export function parseStatementAmount(raw: string, currency: string): bigint | null {
  let value = raw.trim().replace(/−/g, "-");
  if (!value) return null;
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  const suffix = value.match(/\s*(CR|DR)\.?$/i);
  if (suffix) {
    if (suffix[1]!.toUpperCase() === "DR") negative = !negative;
    value = value.slice(0, suffix.index);
  }
  value = value.replace(/[^\d.,\-+]/g, "");
  if (value.startsWith("-") || value.endsWith("-")) {
    negative = !negative;
    value = value.replace(/^-|-$/g, "");
  }
  value = value.replace(/^\+/, "").replace(/,/g, "");
  if (!value) return null;
  const minor = fromDecimalString(value, currency);
  if (minor === null) return null;
  return negative ? -minor : minor;
}

/** Same date, amount and description (case and spacing ignored) means the same line (D-157). */
export function statementDedupeKey(date: string, amount: bigint, description: string): string {
  return `${date}|${amount}|${description.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

/** A first guess at the mapping from the file's headers and first rows, for an account with none saved. */
export function guessStatementMapping(headers: string[], rows: Record<string, string>[]): Partial<StatementMapping> {
  const find = (...patterns: RegExp[]) => headers.find((h) => patterns.some((p) => p.test(h.trim()))) ?? null;
  const date = find(/^(txn |transaction |value |posting )?date$/i, /date/i);
  const description = find(/narration|description|details|particulars|memo|payee/i);
  const reference = find(/ref|cheque|check|chq/i);
  const moneyIn = find(/deposit|credit|money in|paid in|^in$/i);
  const moneyOut = find(/withdrawal|debit|money out|paid out|^out$/i);
  const amount = find(/^amount$/i, /amount/i);
  const balance = find(/balance/i);
  const sample = date ? rows.map((r) => r[date] ?? "").find((v) => v.trim()) ?? "" : "";
  const dateFormat: StatementDateFormat = /^\d{4}[-/.]/.test(sample)
    ? "YYYY-MM-DD"
    : /[a-z]{3}/i.test(sample)
      ? "DD MMM YYYY"
      : rows.some((r) => date && Number((r[date] ?? "").split(/[/.\-\s]/)[1]) > 12)
        ? "MM/DD/YYYY"
        : "DD/MM/YYYY";
  const split = Boolean(moneyIn && moneyOut && moneyIn !== moneyOut);
  return {
    date: date ?? undefined,
    dateFormat,
    description: description ?? undefined,
    reference,
    amountMode: split ? "split" : "single",
    amount: split ? null : amount,
    moneyIn: split ? moneyIn : null,
    moneyOut: split ? moneyOut : null,
    balance,
  };
}

export const STATEMENT_LINE_STATUSES = ["unmatched", "matched", "excluded"] as const;
export type StatementLineStatus = (typeof STATEMENT_LINE_STATUSES)[number];

export const statementLinesQuerySchema = z.object({
  status: z.enum(STATEMENT_LINE_STATUSES).optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export interface StatementImportResult {
  importId: string;
  imported: number;
  skipped: number;
  /** Rows that couldn't be read, numbered as in the file (header is row 1). */
  failed: { row: number; reason: string }[];
}

export interface StatementLine {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  /** Minor units as a string; money in is positive. */
  amount: string;
  runningBalance: string | null;
  status: StatementLineStatus;
  excludeNote: string | null;
  fileName: string | null;
}

/** "Imported <n> lines · skipped <m> already imported · <k> rows couldn't be read". */
export function statementImportSummary(result: Pick<StatementImportResult, "imported" | "skipped" | "failed">): string {
  return `Imported ${result.imported} lines · skipped ${result.skipped} already imported · ${result.failed.length} rows couldn't be read`;
}
