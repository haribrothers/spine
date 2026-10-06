import { z } from "zod";

/**
 * US-RPT-16–US-RPT-19 (D-137) — the balances a business brings into Spine on
 * its cutover date. Receivables, retention, payables and customer advances
 * come from opening documents; every other account is entered here; the
 * difference sits in 3900 Opening Balance Adjustments.
 */

/** Accounts never entered on the grid (I15): their balances come from opening documents, or are the difference. */
export const OPENING_FROM_DOCUMENTS = ["1100", "1150", "2000", "2200"] as const;
export const OPENING_ADJUSTMENTS_CODE = "3900";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-07-01.");
const amount = z.coerce.bigint().nonnegative("Amounts can't be negative.");

export const saveOpeningBalancesSchema = z.object({
  cutoverDate: isoDate,
  lines: z
    .array(z.object({ accountId: z.string().uuid(), debit: amount.default(0n), credit: amount.default(0n) }))
    .refine((lines) => lines.every((l) => l.debit === 0n || l.credit === 0n), { message: "Enter a debit or a credit for an account, not both." })
    .refine((lines) => new Set(lines.map((l) => l.accountId)).size === lines.length, { message: "Enter each account once." })
    .default([]),
});
export type SaveOpeningBalancesInput = z.infer<typeof saveOpeningBalancesSchema>;

export const OPENING_LOCKED = "Unlock the opening balances to change them.";
export const OPENING_DOCUMENTS_BEFORE = (n: number, earliest: string) =>
  `${n} documents are dated before the cutover date. Pick a date on or before ${earliest}, or move those documents.`;
export const OPENING_ADJUSTMENT_NOTE = "Your old books didn't balance, or a figure is missing. The difference sits in Opening Balance Adjustments until you fix it.";
export const OPENING_INTRO = "Bring in what your business had on the day you start using Spine. Your old software's trial balance on that date has every figure you need.";

export type OpeningBalancesStatus = "not_started" | "draft" | "locked";

export interface OpeningBalanceAccountRow {
  accountId: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  /** Minor units as strings; "0" when nothing was entered. */
  debit: string;
  credit: string;
  /** Read-only rows (1100, 1150, 2000, 2200): their balance from opening documents. */
  fromDocuments: { label: string; debit: string; credit: string } | null;
}

export interface OpeningBalancesView {
  status: OpeningBalancesStatus;
  /** The saved cutover date, or the start of the current financial year before the first save. */
  cutoverDate: string;
  /** The day before the cutover date, which every opening entry is dated. */
  balancesAsOf: string;
  lockedAt: string | null;
  accounts: OpeningBalanceAccountRow[];
  /** Grid and document totals together. */
  totalDebit: string;
  totalCredit: string;
  /** Debits less credits: what sits in 3900 Opening Balance Adjustments (as a credit when positive). */
  adjustment: string;
}

/** The day before a `YYYY-MM-DD` date. */
export function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// US-RPT-17 — opening customer invoices (with retention) and customer credit.

const money = z.coerce.bigint().nonnegative("Amounts can't be negative.");

export const openingInvoiceInputSchema = z
  .object({
    contactId: z.string().uuid("Choose the customer."),
    number: z.string().trim().min(1, "Enter the invoice number from your old system.").max(60),
    invoiceDate: isoDate,
    dueDate: isoDate,
    amountDue: money,
    retentionHeld: money.default(0n),
    jobId: z.string().uuid().optional().nullable().transform((v) => v ?? null),
  })
  .refine((v) => v.amountDue + v.retentionHeld > 0n, { message: "Enter the amount due.", path: ["amountDue"] })
  .refine((v) => v.retentionHeld === 0n || v.jobId, { message: "Choose the job the retention is held on.", path: ["jobId"] })
  .refine((v) => v.dueDate >= v.invoiceDate, { message: "The due date can't be before the invoice date.", path: ["dueDate"] });
export type OpeningInvoiceInput = z.infer<typeof openingInvoiceInputSchema>;

/** `POST /opening-balances/invoices/import`: rows already read from the CSV (ISO dates, minor units), with their row numbers. */
export const openingInvoiceImportSchema = z.object({
  rows: z
    .array(
      z.object({
        row: z.number().int(),
        customer: z.string().trim().min(1),
        number: z.string().trim(),
        invoiceDate: z.string(),
        dueDate: z.string(),
        amountDue: z.string(),
        retentionHeld: z.string().optional().nullable(),
        job: z.string().trim().optional().nullable(),
      }),
    )
    .max(5000, "Split the file into smaller files (up to 5,000 rows)."),
  createCustomers: z.boolean().default(false),
});
export type OpeningInvoiceImportInput = z.infer<typeof openingInvoiceImportSchema>;

export const openingCustomerCreditSchema = z.object({
  contactId: z.string().uuid("Choose the customer."),
  amount: z.coerce.bigint().positive("Enter an amount greater than zero."),
});

export const OPENING_INVOICE_NUMBER_USED = (number: string) => `Invoice ${number} already exists. Use the number from your old system exactly once.`;
export const OPENING_DOCUMENT_HAS_ACTIVITY = "It has payments or credits against it. Remove those first.";

export interface OpeningInvoice {
  id: string;
  contactId: string;
  contactName: string;
  number: string;
  invoiceDate: string;
  dueDate: string;
  /** Minor units as strings. */
  amountDue: string;
  retentionHeld: string;
  job: { id: string; name: string; number: string | null } | null;
  balanceDue: string;
  /** Paid or credited since: can't be changed or removed. */
  hasActivity: boolean;
}

export interface OpeningCustomerCredit {
  id: string;
  contactId: string;
  contactName: string;
  amount: string;
  /** What's left to apply or refund. */
  available: string;
}

export interface OpeningImportResult {
  imported: number;
  failed: { row: number; reason: string }[];
  /** Names in the file that match no contact; nothing was imported (choose "Create these customers" or fix the file). */
  unmatched: string[];
}

// US-RPT-18 — opening vendor bills and vendor credits.

export const openingBillInputSchema = z
  .object({
    contactId: z.string().uuid("Choose the vendor."),
    billNumber: z.string().trim().min(1, "Enter the vendor's bill number.").max(60),
    billDate: isoDate,
    dueDate: isoDate,
    amountDue: z.coerce.bigint().positive("Enter the amount due."),
  })
  .refine((v) => v.dueDate >= v.billDate, { message: "The due date can't be before the bill date.", path: ["dueDate"] });
export type OpeningBillInput = z.infer<typeof openingBillInputSchema>;

export const openingBillImportSchema = z.object({
  rows: z
    .array(
      z.object({
        row: z.number().int(),
        vendor: z.string().trim().min(1),
        number: z.string().trim(),
        billDate: z.string(),
        dueDate: z.string(),
        amountDue: z.string(),
      }),
    )
    .max(5000, "Split the file into smaller files (up to 5,000 rows)."),
  createVendors: z.boolean().default(false),
});
export type OpeningBillImportInput = z.infer<typeof openingBillImportSchema>;

export const openingVendorCreditSchema = z.object({
  contactId: z.string().uuid("Choose the vendor."),
  amount: z.coerce.bigint().positive("Enter an amount greater than zero."),
  vendorReference: z
    .string()
    .trim()
    .max(60)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});

export const OPENING_BILL_NUMBER_USED = (number: string, vendor: string) => `Bill ${number} from ${vendor} is already in Spine. Enter each bill once.`;

export interface OpeningBill {
  id: string;
  contactId: string;
  contactName: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  amountDue: string;
  balanceDue: string;
  hasActivity: boolean;
}

export interface OpeningVendorCredit {
  id: string;
  contactId: string;
  contactName: string;
  number: string | null;
  vendorReference: string | null;
  amount: string;
  /** What's left to apply or have refunded. */
  available: string;
}
