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
  // US-BANK-14: the Type filter and search, for exports (the page filters on screen too).
  type: z.enum(["customer_payments", "vendor_payments", "expenses", "transfers", "money_in_out", "other"], { message: "Choose a type to show." }).optional(),
  search: z.string().max(200).optional(),
  format: z.enum(["csv", "xlsx", "pdf"], { message: "Choose CSV, Excel or PDF." }).optional(),
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
  /** The source was deleted after posting; its reversal is a row of its own. */
  deleted: boolean;
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

/** US-BANK-14 (D-231) — the register's Type filter, by the kind of document behind each entry. */
export const REGISTER_TYPES = ["customer_payments", "vendor_payments", "expenses", "transfers", "money_in_out", "other"] as const;
export type RegisterType = (typeof REGISTER_TYPES)[number];

export const REGISTER_TYPE_LABELS: Record<RegisterType, string> = {
  customer_payments: "Customer payments",
  vendor_payments: "Vendor payments",
  expenses: "Expenses",
  transfers: "Transfers",
  money_in_out: "Money in and out",
  other: "Journals and other",
};

const REGISTER_TYPE_OF: Record<string, RegisterType> = {
  payment: "customer_payments",
  payment_delete: "customer_payments",
  customer_refund: "customer_payments",
  customer_refund_delete: "customer_payments",
  vendor_payment: "vendor_payments",
  vendor_payment_delete: "vendor_payments",
  vendor_refund: "vendor_payments",
  vendor_refund_delete: "vendor_payments",
  expense: "expenses",
  bank_transfer: "transfers",
  bank_transfer_delete: "transfers",
  bank_transaction: "money_in_out",
  bank_transaction_delete: "money_in_out",
};

/** The Type an entry falls under; anything not listed (tax payments, journals, opening balances) is "other". */
export function registerType(sourceType: string): RegisterType {
  return REGISTER_TYPE_OF[sourceType] ?? "other";
}

export function isRegisterType(type: string): type is RegisterType {
  return (REGISTER_TYPES as readonly string[]).includes(type);
}

/** The register's rows of one Type whose what, contact or reference contains the search, ignoring case. */
export function filterRegisterRows<T extends Pick<AccountRegisterRow, "sourceType" | "what" | "reference"> & { contact: { name: string } | null }>(rows: T[], filter: { type?: RegisterType | null; search?: string | null }): T[] {
  const q = filter.search?.trim().toLowerCase();
  return rows.filter((r) => (!filter.type || registerType(r.sourceType) === filter.type) && (!q || `${r.what} ${r.contact?.name ?? ""} ${r.reference ?? ""}`.toLowerCase().includes(q)));
}

/** The forms that remember the account each person used last (US-BANK-03, `user.last_money_accounts`). */
export const MONEY_ACCOUNT_FORMS = ["payment", "vendor_payment", "expense", "refund", "tax_payment", "money_in_out"] as const;
export type MoneyAccountForm = (typeof MONEY_ACCOUNT_FORMS)[number];
export type LastMoneyAccounts = Partial<Record<MoneyAccountForm, string>>;

/** The account a payment, expense or refund used, as its responses carry it. */
export interface MoneyAccountRef {
  id: string;
  name: string;
}

export const INACTIVE_MONEY_ACCOUNT = "Choose one of your active accounts.";

export const SAME_ACCOUNT_TRANSFER = "Choose two different accounts.";

/** `POST /bank-transfers` (US-BANK-04): a deposit, top-up or card payoff between two of the organisation's own accounts. */
export const createBankTransferSchema = z
  .object({
    fromMoneyAccountId: z.string().uuid("Choose the account the money left."),
    toMoneyAccountId: z.string().uuid("Choose the account the money went to."),
    amount: z.coerce.bigint().positive("Enter an amount greater than zero."),
    date: isoDateSchema,
    reference: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
  })
  .refine((v) => v.fromMoneyAccountId !== v.toMoneyAccountId, { message: SAME_ACCOUNT_TRANSFER, path: ["toMoneyAccountId"] });
export type CreateBankTransferInput = z.infer<typeof createBankTransferSchema>;

export interface BankTransfer {
  id: string;
  fromMoneyAccount: MoneyAccountRef;
  toMoneyAccount: MoneyAccountRef;
  /** Minor units as a string. */
  amount: string;
  date: string;
  reference: string | null;
  deletedAt: string | null;
}

/**
 * Accounts that move only through their own documents, never through money
 * in or out (US-BANK-05) or a manual journal (D-134): receivables,
 * retention, input and output tax, payables, customer advances, retained
 * earnings and opening balance adjustments.
 */
export const CONTROL_ACCOUNT_CODES = ["1100", "1150", "1200", "2000", "2100", "2200", "3200", "3900"] as const;
export const CONTROL_ACCOUNT_HINT = "Use a payment, bill or tax payment for this.";
export const MONEY_ACCOUNT_AS_CATEGORY = "Use a transfer between your accounts for this.";

export const BANK_TRANSACTION_DIRECTIONS = ["in", "out"] as const;
export type BankTransactionDirection = (typeof BANK_TRANSACTION_DIRECTIONS)[number];

/** The category shortcuts on Money in / Money out (D-174), by the ledger code they pick. */
export const BANK_TRANSACTION_SHORTCUTS: { label: string; code: string; direction: BankTransactionDirection }[] = [
  { label: "Owner's capital", code: "3000", direction: "in" },
  { label: "Loan received", code: "2500", direction: "in" },
  { label: "Interest received", code: "4800", direction: "in" },
  { label: "Owner's drawings", code: "3100", direction: "out" },
  { label: "Loan repayment", code: "2500", direction: "out" },
  { label: "Bank charges", code: "6900", direction: "out" },
];

const optionalUuid = z.string().uuid().optional().nullable().transform((v) => v ?? null);

/** `POST /bank-transactions` (US-BANK-05). `amount` is what moved through the account; on money out any tax is included in it. */
export const createBankTransactionSchema = z
  .object({
    moneyAccountId: z.string().uuid("Choose the account."),
    direction: z.enum(BANK_TRANSACTION_DIRECTIONS),
    accountId: z.string().uuid("Choose a category."),
    contactId: optionalUuid,
    amount: z.coerce.bigint().positive("Enter an amount greater than zero."),
    taxRateId: optionalUuid,
    taxGroupId: optionalUuid,
    date: isoDateSchema,
    description: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
  })
  .refine((v) => v.direction === "out" || (!v.taxRateId && !v.taxGroupId), { message: "Tax applies to money out only.", path: ["taxRateId"] })
  .refine((v) => !(v.taxRateId && v.taxGroupId), { message: "Choose a tax rate or a tax group, not both.", path: ["taxGroupId"] });
export type CreateBankTransactionInput = z.infer<typeof createBankTransactionSchema>;

export interface BankTransaction {
  id: string;
  moneyAccount: MoneyAccountRef;
  direction: BankTransactionDirection;
  account: { id: string; code: string; name: string };
  contact: { id: string; name: string } | null;
  amount: string;
  taxAmount: string;
  date: string;
  description: string | null;
  deletedAt: string | null;
}

/** US-BANK-14 — a money in or out entry or a transfer as the register's drawer shows it. */
export interface BankEntryDetails {
  /** Its line on the money account is part of a finished reconciliation (it can't be deleted). */
  reconciled: boolean;
  taxName: string | null;
  createdBy: string | null;
  createdAt: string;
}
