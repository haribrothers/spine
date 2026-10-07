import { z } from "zod";

/**
 * US-RPT-24, US-RPT-25 — the general ledger and day book. Every journal
 * entry carries a source type; these group them into the kinds people
 * recognise ("Invoices", "Payments", "Journals"…).
 */
export const LEDGER_SOURCE_KINDS: { key: string; label: string; types: string[] }[] = [
  { key: "invoice", label: "Invoices", types: ["invoice", "invoice_void"] },
  { key: "credit_note", label: "Credit notes", types: ["credit_note", "credit_note_credit_applied"] },
  { key: "payment", label: "Payments", types: ["payment", "payment_delete", "payment_credit_applied"] },
  { key: "customer_refund", label: "Refunds", types: ["customer_refund", "customer_refund_delete"] },
  { key: "vendor_bill", label: "Bills", types: ["vendor_bill", "vendor_bill_void"] },
  { key: "vendor_credit", label: "Vendor credits", types: ["vendor_credit", "vendor_credit_void", "vendor_refund", "vendor_refund_delete"] },
  { key: "vendor_payment", label: "Vendor payments", types: ["vendor_payment", "vendor_payment_delete"] },
  { key: "expense", label: "Expenses", types: ["expense"] },
  { key: "banking", label: "Transfers and money in or out", types: ["bank_transfer", "bank_transfer_delete", "bank_transaction", "bank_transaction_delete"] },
  { key: "tax", label: "Tax payments", types: ["tax_payment", "tax_refund", "tax_payment_delete"] },
  { key: "journal", label: "Journals", types: ["manual_journal", "manual_journal_reversal"] },
  {
    key: "opening",
    label: "Opening balances",
    types: ["opening_balance", "opening_balance_repost", "opening_invoice", "opening_invoice_repost", "opening_customer_credit", "opening_customer_credit_repost", "opening_bill", "opening_bill_repost", "opening_vendor_credit", "opening_vendor_credit_repost"],
  },
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30.");

export const generalLedgerQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  /** Comma-separated account ids; all accounts when absent. */
  accountIds: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : [])),
  /** "Hide accounts with no activity" is on unless this is "true". */
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

/** Where an entry came from, as people say it, and where its document opens. */
export interface LedgerSource {
  sourceType: string;
  sourceId: string;
  /** "Invoice INV-0042", "Payment RCP-0012", "Journal JNL-0003"… */
  label: string;
  href: string | null;
}

export interface GeneralLedgerRow extends LedgerSource {
  journalLineId: string;
  entryId: string;
  date: string;
  contact: { id: string; name: string } | null;
  job: { id: string; name: string; number: string | null } | null;
  description: string | null;
  /** Minor units as strings. */
  debit: string;
  credit: string;
  /** Debit-positive running balance after this row. */
  balance: string;
}

export interface GeneralLedgerAccount {
  account: { id: string; code: string; name: string; type: string };
  /** Debit-positive. */
  openingBalance: string;
  rows: GeneralLedgerRow[];
  closingBalance: string;
}

export interface GeneralLedgerReport {
  from: string;
  to: string;
  accounts: GeneralLedgerAccount[];
  page: number;
  pageSize: number;
  totalAccounts: number;
  /** US-RPT-40 — every listed account's lines in the range (all pages): how many, and their debits and credits in minor units. */
  totals: { lines: number; debit: string; credit: string };
}

export const dayBookQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  /** A `LEDGER_SOURCE_KINDS` key; every source when absent. */
  sourceType: z
    .string()
    .optional()
    .refine((v) => !v || LEDGER_SOURCE_KINDS.some((k) => k.key === v), "Choose one of the listed sources."),
});

export interface DayBookEntry extends LedgerSource {
  entryId: string;
  date: string;
  /** The entry's full narration, as posted. */
  narration: string | null;
  /** What follows the source in the narration (the reason, the bill reference…); null when it only repeats the source. */
  description: string | null;
  /** The first contact on the entry's lines. */
  contact: { id: string; name: string } | null;
  /** Debits first, then credits, by account code. */
  lines: { account: { id: string; code: string; name: string }; debit: string; credit: string }[];
}

export interface DayBookReport {
  from: string;
  to: string;
  entries: DayBookEntry[];
}
