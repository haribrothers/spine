import { fromDecimalString } from "@spine/shared/money";
import { LABOUR_NEEDS_JOB, LABOUR_ROW_INCOMPLETE, labourLineAmount, labourTotal } from "@spine/shared/schemas";
import { MAX_UPLOAD_BYTES, type ExpensePayload, type LocalPhoto } from "../../lib/outbox/types";

export const CHOOSE_CATEGORY = "Choose a category.";
export const AMOUNT_ABOVE_ZERO = "Enter an amount above zero.";
export const RECEIPT_TOO_BIG = "This photo is over 10 MB. Retake it closer, or choose a smaller one.";
export const EXPENSE_NOTE = "Your office approves it before it's paid back. No signal? It's saved and sent later.";
export const LABOUR_NOTE = "Labour is always for a job. Only trades, headcounts and day rates — no names or hours.";

export type EntryMode = "amount" | "labour";

export interface TradeRow {
  key: string;
  trade: string;
  headcount: string;
  dayRate: string;
}

export interface ExpenseDraft {
  mode: EntryMode;
  amount: string;
  categoryId: string | null;
  jobId: string | null;
  date: Date;
  paidBy: "employee" | "company";
  description: string;
  receipt: LocalPhoto | null;
  trades: TradeRow[];
}

/** "1,250.50" → minor units in the currency, or null when it isn't a number. */
export function parseAmount(text: string, currency: string): bigint | null {
  const clean = text.replace(/[,\s]/g, "").replace(/^\./, "0.");
  return clean ? fromDecimalString(clean, currency) : null;
}

export function rowAmount(row: TradeRow, currency: string): bigint | null {
  const headcount = Number.parseInt(row.headcount, 10);
  const rate = parseAmount(row.dayRate, currency);
  if (!row.trade.trim() || !Number.isFinite(headcount) || headcount < 1 || rate === null || rate <= 0n) return null;
  return labourLineAmount({ headcount, dayRateAmount: rate });
}

export function tradesTotal(rows: TradeRow[], currency: string): bigint {
  return labourTotal(rows.map((row) => ({ headcount: Number.parseInt(row.headcount, 10) || 0, dayRateAmount: parseAmount(row.dayRate, currency) ?? 0n })));
}

export type DraftErrors = Partial<Record<"amount" | "category" | "job" | "trades" | "receipt", string>>;

/** US-MOB-13 — what's wrong, under each field. */
export function validateDraft(draft: ExpenseDraft, currency: string): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.categoryId) errors.category = CHOOSE_CATEGORY;
  if (draft.mode === "amount") {
    const amount = parseAmount(draft.amount, currency);
    if (amount === null || amount <= 0n) errors.amount = AMOUNT_ABOVE_ZERO;
  } else {
    if (!draft.jobId) errors.job = LABOUR_NEEDS_JOB;
    if (!draft.trades.length || draft.trades.some((row) => rowAmount(row, currency) === null)) errors.trades = LABOUR_ROW_INCOMPLETE;
  }
  if (draft.receipt && draft.receipt.size > MAX_UPLOAD_BYTES) errors.receipt = RECEIPT_TOO_BIG;
  return errors;
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The outbox payload for a valid draft (labour sends the rows' total as the amount; the server checks it, D-199). */
export function toPayload(draft: ExpenseDraft, names: { category: string; job: string | null }, currency: string): ExpensePayload {
  const labour = draft.mode === "labour";
  const amount = labour ? tradesTotal(draft.trades, currency) : parseAmount(draft.amount, currency)!;
  return {
    categoryId: draft.categoryId!,
    categoryName: names.category,
    jobId: draft.jobId,
    jobName: names.job,
    date: isoDay(draft.date),
    amount: amount.toString(),
    currency,
    description: draft.description.trim() || null,
    paidBy: draft.paidBy,
    receipt: draft.receipt,
    ...(labour
      ? {
          entryMode: "labour" as const,
          labourLines: draft.trades.map((row) => ({ trade: row.trade.trim(), headcount: Number.parseInt(row.headcount, 10), dayRateAmount: parseAmount(row.dayRate, currency)!.toString() })),
        }
      : {}),
  };
}

/** Back from a queued payload (Fix → edit). */
export function fromPayload(payload: ExpensePayload, minorToText: (minor: string) => string): ExpenseDraft {
  const [y, m, d] = payload.date.split("-").map(Number) as [number, number, number];
  return {
    mode: payload.entryMode === "labour" ? "labour" : "amount",
    amount: minorToText(payload.amount),
    categoryId: payload.categoryId,
    jobId: payload.jobId,
    date: new Date(y, m - 1, d),
    paidBy: payload.paidBy,
    description: payload.description ?? "",
    receipt: payload.receipt,
    trades: (payload.labourLines ?? []).map((line, i) => ({ key: `row-${i}`, trade: line.trade, headcount: String(line.headcount), dayRate: minorToText(line.dayRateAmount) })),
  };
}
