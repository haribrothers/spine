import { fromDecimalString, toDecimalString } from "@spine/shared/money";
import { AI_UNAVAILABLE_MESSAGE, LABOUR_NEEDS_JOB, LABOUR_ROW_INCOMPLETE, labourLineAmount, labourTotal, type ReceiptSuggestion } from "@spine/shared/schemas";
import { ApiError, OfflineError } from "../../lib/api/errors";
import { calendarDay } from "../../lib/format";
import { RejectedError } from "../../lib/outbox/send";
import { MAX_UPLOAD_BYTES, type ExpensePayload, type LocalPhoto } from "../../lib/outbox/types";

export const CHOOSE_CATEGORY = "Choose a category.";
export const AMOUNT_ABOVE_ZERO = "Enter an amount above zero.";
export const RECEIPT_TOO_BIG = "This photo is over 10 MB. Retake it closer, or choose a smaller one.";
export const EXPENSE_NOTE = "Your office approves it before it's paid back. No signal? It's saved and sent later.";
export const LABOUR_NOTE = "Labour is always for a job. Only trades, headcounts and day rates — no names or hours.";
/** US-AI-10 — above the form once AI has filled something in. */
export const AI_FILLED_NOTE = "Filled in from your receipt. Check the amount, date and category before you submit.";
/** US-AI-10 — "Read receipt" without a connection: the expense still queues as it always has (US-MOB-13). */
export const READ_RECEIPT_OFFLINE = "Needs a connection — fill it in, or read it later.";
export const AI_KEPT_NOTE = "Your entries are kept.";
/** The phone has no currency field: a receipt in another currency fills everything but the amount. */
export const receiptCurrencyNote = (receipt: string, business: string) => `The receipt is in ${receipt}, so the amount wasn't filled in — enter it in ${business}.`;

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
  /** US-AI-10 — AI filled something in; the expense says so once saved (US-AI-06). Stays once set (D-245). */
  aiAssisted?: boolean;
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
    ...(draft.aiAssisted ? { aiAssisted: true } : {}),
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
    ...(payload.aiAssisted ? { aiAssisted: true } : {}),
  };
}

/** The fields AI fills on the phone (US-AI-10): no tax — the phone form has none. */
export type AiExpenseField = "amount" | "category" | "date" | "description";

/** What a draft already holds that counts as the person's own: a fixed expense's values do; a new one's default date doesn't. */
export function enteredFields(draft: ExpenseDraft, editing: boolean): Set<AiExpenseField> {
  const entered = new Set<AiExpenseField>();
  if (!editing) return entered;
  if (draft.amount.trim()) entered.add("amount");
  if (draft.categoryId) entered.add("category");
  entered.add("date");
  if (draft.description.trim()) entered.add("description");
  return entered;
}

export interface ReceiptFill {
  /** Values for the fields AI may fill. */
  patch: Partial<ExpenseDraft>;
  filled: AiExpenseField[];
  /** AI's values for fields the person had already filled — "Replace my entries (<n>)". */
  kept: Partial<ExpenseDraft>;
  keptFields: AiExpenseField[];
  /** Set when the receipt's currency isn't the business's, so the amount stayed empty. */
  currencyNote: string | null;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * US-AI-10 and the shared rules (21-ai.md) — what a read receipt fills:
 * Amount (only in the business currency), Date (never a future one),
 * Category (only one of the business's own) and Description; tax isn't
 * filled — the phone form has none. A field the person entered keeps its
 * value and is offered by "Replace my entries". Run it on the draft as it
 * is when the answer arrives (US-AI-07).
 */
export function planReceiptFill(
  draft: ExpenseDraft,
  entered: ReadonlySet<AiExpenseField>,
  suggestion: ReceiptSuggestion,
  context: { currency: string; categoryIds: ReadonlySet<string>; today: Date },
): ReceiptFill {
  const read: Partial<Record<AiExpenseField, Partial<ExpenseDraft>>> = {};
  let currencyNote: string | null = null;
  if (suggestion.amount) {
    if (!suggestion.currency || suggestion.currency === context.currency) read.amount = { amount: toDecimalString({ amount: BigInt(suggestion.amount), currency: context.currency }) };
    else currencyNote = receiptCurrencyNote(suggestion.currency, context.currency);
  }
  if (suggestion.date) {
    const day = calendarDay(suggestion.date);
    const today = new Date(context.today.getFullYear(), context.today.getMonth(), context.today.getDate());
    if (day.getTime() <= today.getTime()) read.date = { date: day };
  }
  if (suggestion.categoryId && context.categoryIds.has(suggestion.categoryId)) read.category = { categoryId: suggestion.categoryId };
  if (suggestion.description) read.description = { description: suggestion.description };

  const empty: Record<AiExpenseField, boolean> = {
    amount: (parseAmount(draft.amount, context.currency) ?? 0n) <= 0n,
    // A category deleted or archived since the expense was queued shows as "Choose a category": empty.
    category: !draft.categoryId || !context.categoryIds.has(draft.categoryId),
    date: false,
    description: !draft.description.trim(),
  };
  const differs: Record<AiExpenseField, (value: Partial<ExpenseDraft>) => boolean> = {
    amount: (v) => parseAmount(draft.amount, context.currency) !== parseAmount(v.amount ?? "", context.currency),
    category: (v) => v.categoryId !== draft.categoryId,
    date: (v) => !sameDay(v.date!, draft.date),
    description: (v) => v.description !== draft.description.trim(),
  };
  const fill: ReceiptFill = { patch: {}, filled: [], kept: {}, keptFields: [], currencyNote };
  for (const field of ["amount", "category", "date", "description"] as const) {
    const value = read[field];
    if (!value) continue;
    if (!entered.has(field) || empty[field]) {
      Object.assign(fill.patch, value);
      fill.filled.push(field);
    } else if (differs[field](value)) {
      Object.assign(fill.kept, value);
      fill.keptFields.push(field);
    }
  }
  return fill;
}

/**
 * US-AI-07 on the phone — what "Read receipt" says when it didn't work: no
 * connection, a refusal in the server's own words (a paused budget, too
 * many requests, a model that can't read images), or "AI didn't answer…"
 * with Try again.
 */
export function readFailure(error: unknown): { message: string; canRetry: boolean } {
  if (error instanceof OfflineError) return { message: READ_RECEIPT_OFFLINE, canRetry: true };
  if (error instanceof RejectedError) return { message: error.message, canRetry: false };
  if (error instanceof ApiError && error.status < 500) return { message: error.message, canRetry: false };
  return { message: AI_UNAVAILABLE_MESSAGE, canRetry: true };
}
