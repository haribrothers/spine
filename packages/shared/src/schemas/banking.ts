import { z } from "zod";

/**
 * D-140 — a money account is one ledger account (bank and cash: asset,
 * codes 1010–1099; card: liability, codes 2300–2399) plus its kind, name
 * and statement settings.
 */
export const MONEY_ACCOUNT_KINDS = ["bank", "cash", "card"] as const;
export const moneyAccountKindSchema = z.enum(MONEY_ACCOUNT_KINDS);
export type MoneyAccountKind = z.infer<typeof moneyAccountKindSchema>;

export const MONEY_ACCOUNT_KIND_LABELS: Record<MoneyAccountKind, string> = {
  bank: "Bank account",
  cash: "Cash",
  card: "Credit card",
};

/** The ledger code range each kind takes its next free code from (D-140). */
export const MONEY_ACCOUNT_CODE_RANGES: Record<MoneyAccountKind, { from: number; to: number; type: "asset" | "liability" }> = {
  bank: { from: 1011, to: 1099, type: "asset" },
  cash: { from: 1011, to: 1099, type: "asset" },
  card: { from: 2300, to: 2399, type: "liability" },
};

const optionalText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const moneyAccountInputSchema = z.object({
  kind: moneyAccountKindSchema,
  name: z.string().trim().min(1, "Give the account a name.").max(120, "Use 120 characters or fewer for the name."),
  bankName: optionalText,
  last4: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4}$/.test(v), "Enter the last 4 digits as four numbers."),
  isDefault: z.boolean().optional().default(false),
});
export type MoneyAccountInput = z.infer<typeof moneyAccountInputSchema>;

/** `GET /money-accounts` row. Balances and reconciliation fields only reach callers with `banking.view`. */
export interface MoneyAccount {
  id: string;
  accountId: string;
  code: string;
  kind: MoneyAccountKind;
  name: string;
  bankName: string | null;
  last4: string | null;
  isDefault: boolean;
  archivedAt: string | null;
  /** Minor units as a string. For a card, what's owed on it (credit balance). */
  balance?: string;
  lastReconciledOn?: string | null;
  unreconciledCount?: number;
}

/** `GET /money-accounts/next-codes` — the ledger code a new account of each kind would get. */
export type MoneyAccountNextCodes = Record<MoneyAccountKind, string | null>;

export const DUPLICATE_MONEY_ACCOUNT_NAME = (name: string) => `You already have an account called ${name}. Choose another name.`;

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-05.");

/** `GET /money-accounts/:id/register` query (US-BANK-02). */
export const accountRegisterQuerySchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  unreconciled: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
export type AccountRegisterQuery = z.infer<typeof accountRegisterQuerySchema>;

/**
 * One journal line on the money account. `in` and `out` are in the
 * account's own sense: for a card, `in` is "Paid off" and `out` is "Spent",
 * and `balance` is what's owed. Amounts are minor units as strings.
 */
export interface AccountRegisterRow {
  journalLineId: string;
  date: string;
  sourceType: string;
  sourceId: string;
  /** What it was, e.g. "Payment RCT-0018" or "Money out — Bank charges". */
  what: string;
  number: string | null;
  contact: { id: string; name: string } | null;
  reference: string | null;
  in: string;
  out: string;
  balance: string;
  reconciled: boolean;
}

export interface AccountRegister {
  account: MoneyAccount & { balance: string };
  from: string | null;
  to: string | null;
  /** The true balance before `from` (0 without `from`). */
  openingBalance: string;
  rows: AccountRegisterRow[];
  closingBalance: string;
  totalIn: string;
  totalOut: string;
  /** Whether anything has ever gone in or out of the account, regardless of filters. */
  hasEntries: boolean;
}
