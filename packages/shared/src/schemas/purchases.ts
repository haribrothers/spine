import { z } from "zod";
import { currencyCodeSchema, hsnSacSchema, placeOfSupplySchema, uuidSchema } from "./common.ts";
import { SUPPLY_CLASSES } from "../tax/supply-class.ts";

export const vendorBillLineTypeSchema = z.enum(["item", "heading", "text"]);

/** Structurally identical to invoiceLineInputSchema/quoteLineInputSchema — see quotes.ts's own doc comment for the full "one permissive shape covers item/heading/text" reasoning. `accountId` is the Expense/COGS account this line debits at record() time — required for an item line, meaningless for heading/text. */
export const vendorBillLineInputSchema = z.object({
  id: uuidSchema.optional(),
  type: vendorBillLineTypeSchema.default("item"),
  catalogItemId: uuidSchema.optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  quantity: z.coerce.number().min(0).default(0),
  unitPriceAmount: z.coerce.bigint().default(0n),
  unitPriceCurrency: currencyCodeSchema.optional(),
  accountId: uuidSchema.optional().nullable(),
  taxRatePercentage: z.coerce.number().min(0).max(100).default(0),
  taxRateId: uuidSchema.optional().nullable(),
  taxGroupId: uuidSchema.optional().nullable(),
  isTaxInclusive: z.boolean().default(false),
  /** US-TAX-11 — why an untaxed line has no tax; a taxed line is always taxable. */
  supplyClass: z.enum(SUPPLY_CLASSES).optional().nullable(),
  /** US-TAX-14 — the line's HSN/SAC code, copied from its item. */
  hsnSac: hsnSacSchema.optional().nullable(),
});

/** PRD F7 (S-07.1) — a draft vendor bill. Every money total is absent — always server-computed, never trusted from the client, same as createInvoiceSchema/createQuoteSchema. */
export const createVendorBillSchema = z.object({
  contactId: uuidSchema,
  jobId: uuidSchema.optional().nullable(),
  billNumber: z.string().min(1),
  date: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  currency: currencyCodeSchema,
  notes: z.string().optional().nullable(),
  lines: z.array(vendorBillLineInputSchema).default([]),
  /** US-TAX-13 — the GST place of supply (state code, or "96" for other countries); defaults from the contact. */
  placeOfSupply: placeOfSupplySchema.optional().nullable(),
  /** US-AI-06 (D-166) — saved from fields AI filled in; marks the record and this save in its Activity. */
  aiAssisted: z.boolean().optional(),
});

/** A draft-only update — see VendorBillsService.update's own guard against editing a recorded bill. */
// Without the create default: a partial update must not clear the lines.
export const updateVendorBillSchema = createVendorBillSchema.partial().extend({ lines: z.array(vendorBillLineInputSchema).optional() });

/** Void requires a reason, mirroring voidInvoiceSchema exactly. */
export const voidVendorBillSchema = z.object({
  reason: z.string().min(1, "A reason is required to void a vendor bill"),
});

/** US-PUR-47 (D-228) — the "What it's for" line's limit. */
export const EXPENSE_CATEGORY_DESCRIPTION_MAX = 120;

export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1, "Give the category a name."),
  /** US-PUR-46 — the "What it's for" line; empty clears it. */
  description: z.string().trim().max(EXPENSE_CATEGORY_DESCRIPTION_MAX, "Keep what it's for under 120 characters.").nullable().optional(),
  accountId: uuidSchema.optional().nullable(),
  /** US-PUR-48 — an active rate, filled in on a new expense's form. */
  defaultTaxRateId: uuidSchema.optional().nullable(),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();

export const expensePaidBySchema = z.enum(["company", "employee"]);

/** US-PUR-23 (D-126) — one row of a labour expense: a trade, how many worked, at what day rate. No names, attendance or hours. */
export const LABOUR_ROW_INCOMPLETE = "Every row needs a trade, at least one worker and a day rate.";
export const LABOUR_NEEDS_JOB = "Labour is always for a job — choose one.";
export const LABOUR_MAX_ROWS = 20;

export const labourLineSchema = z.object({
  trade: z.string({ error: LABOUR_ROW_INCOMPLETE }).trim().min(1, LABOUR_ROW_INCOMPLETE).max(60, "Keep each trade under 60 characters."),
  headcount: z.coerce.number({ error: LABOUR_ROW_INCOMPLETE }).int(LABOUR_ROW_INCOMPLETE).min(1, LABOUR_ROW_INCOMPLETE).max(1000),
  dayRateAmount: z.coerce.bigint({ error: LABOUR_ROW_INCOMPLETE }).positive(LABOUR_ROW_INCOMPLETE),
});
export type LabourLineInput = z.infer<typeof labourLineSchema>;

/** Headcount × day rate, in minor units — exact, no rounding. */
export function labourLineAmount(line: { headcount: number; dayRateAmount: bigint }): bigint {
  return BigInt(line.headcount) * line.dayRateAmount;
}

/** The day's total for a labour expense. */
export function labourTotal(lines: readonly { headcount: number; dayRateAmount: bigint }[]): bigint {
  return lines.reduce((sum, line) => sum + labourLineAmount(line), 0n);
}

/** D-250 — a file is linked to a record only by the person who uploaded it, while nothing else uses it. */
export const linkUploadFirst = (thing: string) => `Upload the ${thing} first.`;
export const linkInUse = (thing: string) => `This file is already used elsewhere. Upload the ${thing} again to use it here.`;
/** D-250 — an expense's receipt is a file its submitter just uploaded, as an attachment is (US-OPS-33). */
export const RECEIPT_UPLOAD_FIRST = linkUploadFirst("receipt");
export const RECEIPT_IN_USE = linkInUse("receipt");

/** PRD F7 (S-07.2/S-07.3) — a field/staff-submitted expense. No total/tax computation trusted from the client beyond the raw amount/taxAmount themselves (there's no multi-line breakdown to sum here, unlike quotes/invoices — an expense is a single amount). */
export const createExpenseSchema = z.object({
  categoryId: uuidSchema,
  jobId: uuidSchema.optional().nullable(),
  date: z.coerce.date(),
  currency: currencyCodeSchema,
  amount: z.coerce.bigint().positive(),
  taxAmount: z.coerce.bigint().default(0n),
  taxRateId: uuidSchema.optional().nullable(),
  description: z.string().optional().nullable(),
  paidBy: expensePaidBySchema.default("company"),
  receiptFileId: uuidSchema.optional().nullable(),
  isBillable: z.boolean().default(false),
  /** US-BANK-03 — the account it was paid from; omitted means the organisation's default. */
  moneyAccountId: uuidSchema.optional().nullable(),
  /** US-PUR-23 — "amount" (the default when absent) or "labour", where `amount` must equal the labour rows' total. */
  entryMode: z.enum(["amount", "labour"]).optional(),
  labourLines: z.array(labourLineSchema).max(LABOUR_MAX_ROWS, `Enter up to ${LABOUR_MAX_ROWS} trades.`).optional(),
  /** US-AI-06 (D-166) — saved from fields AI filled in; marks the record and this save in its Activity. */
  aiAssisted: z.boolean().optional(),
});

/** A submitted-only update — see ExpensesService.update's own guard against editing a reviewed expense. */
// Without the create defaults: a partial update must not reset tax, who paid or billable.
export const updateExpenseSchema = createExpenseSchema.partial().extend({ taxAmount: z.coerce.bigint().optional(), paidBy: expensePaidBySchema.optional(), isBillable: z.boolean().optional() });

/** S-07.4 — reject requires a comment; approve's comment is optional. */
export const reviewExpenseSchema = z.object({
  comment: z.string().optional().nullable(),
  /** US-BANK-03 — the approver can change the account before approving. */
  moneyAccountId: uuidSchema.optional().nullable(),
});

export const rejectExpenseSchema = z.object({
  comment: z.string().min(1, "A comment is required to reject an expense"),
});

export const vendorPaymentMethodSchema = z.enum(["cash", "bank_transfer", "cheque", "card", "upi", "other"]);

/** One allocation line — mirrors paymentAllocationInputSchema exactly, targeting a bill instead of an invoice. */
export const vendorPaymentAllocationInputSchema = z.object({
  billId: uuidSchema,
  amount: z.coerce.bigint().positive(),
});

/**
 * PRD F7 (S-07.8) — records a payment to a vendor, allocated across one or
 * more of their bills in the same call. Unlike the customer-side
 * `createPaymentSchema`, FEAT-07 has no "held as vendor credit" story
 * (that's `Customer Advances`' own S-06.4 concept — there is no vendor-side
 * equivalent asked for), so `allocations` must sum to EXACTLY `amount` —
 * enforced by VendorPaymentsService.create, not just this shape check.
 * `allocations` still can't be empty (`.min(1)`, not `.default([])` like
 * the customer side) for the same reason.
 */
export const createVendorPaymentSchema = z.object({
  contactId: uuidSchema,
  date: z.coerce.date(),
  method: vendorPaymentMethodSchema,
  reference: z.string().optional().nullable(),
  currency: currencyCodeSchema,
  amount: z.coerce.bigint().positive(),
  notes: z.string().optional().nullable(),
  /** US-BANK-03 — the account the money came out of; omitted means the organisation's default. */
  moneyAccountId: uuidSchema.optional().nullable(),
  allocations: z.array(vendorPaymentAllocationInputSchema).min(1),
});

/** US-PUR-24 (D-141) — a vendor credit draft: like a bill, with the vendor's own credit note number and an optional "against bill". */
export const createVendorCreditSchema = z.object({
  contactId: uuidSchema,
  vendorReference: z.string().trim().min(1, "Enter the vendor's credit note number."),
  billId: uuidSchema.optional().nullable(),
  jobId: uuidSchema.optional().nullable(),
  date: z.coerce.date(),
  currency: currencyCodeSchema,
  notes: z.string().optional().nullable(),
  lines: z.array(vendorBillLineInputSchema).default([]),
  /** US-TAX-13 — the GST place of supply (state code, or "96" for other countries); defaults from the contact. */
  placeOfSupply: placeOfSupplySchema.optional().nullable(),
});
export const updateVendorCreditSchema = createVendorCreditSchema.partial().extend({ lines: z.array(vendorBillLineInputSchema).optional() });

export const voidVendorCreditSchema = z.object({
  reason: z.string().trim().min(1, "Give a reason for voiding this credit."),
});

export const VENDOR_CREDIT_STATUS_LABELS = { draft: "Draft", open: "Open", used: "Used", void: "Void" } as const;
export type VendorCreditStatus = keyof typeof VENDOR_CREDIT_STATUS_LABELS;

/** `POST /vendor-credits/:id/apply` (US-PUR-25). */
export const applyVendorCreditSchema = z.object({
  allocations: z.array(z.object({ billId: uuidSchema, amount: z.coerce.bigint().positive("Enter an amount greater than zero.") })).min(1, "Choose at least one bill."),
});

/** `POST /vendor-credits/:id/refunds` (US-PUR-26). */
export const createVendorRefundSchema = z.object({
  amount: z.coerce.bigint().positive("Enter an amount greater than zero."),
  date: z.coerce.date(),
  moneyAccountId: uuidSchema.optional().nullable(),
  method: vendorPaymentMethodSchema,
  reference: z.string().trim().max(120).optional().nullable(),
});

/** US-PUR-32 (D-225) — one line of a vendor bill's Activity: `GET /vendor-bills/:id/activity`, newest first. */
export interface VendorBillActivityEntry {
  type: "created" | "recorded" | "paid" | "credit_applied" | "voided" | "payment_deleted";
  at: string;
  actorName: string | null;
  /** Minor units: the bill's total when recorded, a payment's or credit's amount on this bill. */
  amount?: string | null;
  /** The payment or credit number; the reason a bill was voided. */
  detail?: string | null;
  /** The vendor payment or vendor credit it links to. */
  linkId?: string | null;
  /** US-AI-06 — this save was filled in with AI ("· filled in with AI"). */
  aiAssisted?: true;
}

/** US-PUR-35 — a bill this vendor already has with the same number: `GET /vendor-bills/possible-duplicates`. */
export interface PossibleDuplicateVendorBill {
  id: string;
  billNumber: string;
  date: string;
  totalAmount: string;
  currency: string;
  status: "draft" | "recorded" | "void";
}

/** US-PUR-43 (D-227) — one line in an expense's Activity: `GET /expenses/:id/activity`. */
export interface ExpenseActivityEntry {
  type: "submitted" | "edited" | "rejected" | "resubmitted" | "approved" | "billed";
  at: string;
  actorName: string | null;
  /** The amount approved. */
  amount?: string | null;
  /** The review comment; what was edited; the invoice number it was billed on. */
  detail?: string | null;
  /** The invoice it was billed on. */
  linkId?: string | null;
  /** US-AI-06 — this save was filled in with AI ("· filled in with AI"). */
  aiAssisted?: true;
}

/** US-PUR-44 — an expense of mine with the same amount on the same day: `GET /expenses/possible-duplicates`. */
export interface PossibleDuplicateExpense {
  id: string;
  number: string | null;
  date: string;
  amount: string;
  currency: string;
  categoryName: string | null;
  status: "submitted" | "approved" | "rejected";
}

/** US-PUR-37 (D-226) — one line in a vendor credit's Activity: `GET /vendor-credits/:id/activity`. */
export interface VendorCreditActivityEntry {
  type: "created" | "recorded" | "applied" | "unapplied" | "refunded" | "refund_deleted" | "voided";
  at: string;
  actorName: string | null;
  /** Minor units: the credit's total when recorded, an application's or refund's amount. */
  amount?: string | null;
  /** The bill number applied to or removed from; the reason a credit was voided. */
  detail?: string | null;
  /** The vendor bill it links to. */
  linkId?: string | null;
}

/** US-PUR-39 — a credit this vendor already has with the same credit note number: `GET /vendor-credits/possible-duplicates`. */
export interface PossibleDuplicateVendorCredit {
  id: string;
  number: string | null;
  vendorReference: string | null;
  date: string;
  totalAmount: string;
  currency: string;
  status: "draft" | "open" | "used" | "void";
}

/** US-PUR-35 — a bill number compared the way the duplicate check does: no spaces, any case. */
export function normaliseBillNumber(billNumber: string): string {
  return billNumber.replace(/\s+/g, "").toLowerCase();
}

/** US-PUR-46 (D-228) — `GET /expense-categories/usage`, Owners and Staff only. */
export interface ExpenseCategoryUsage {
  categoryId: string;
  expenseCount: number;
  /** Approved this month, by approval date, in the business's currency (minor units). */
  approvedThisMonth: string;
}

/** US-PUR-49 (D-229) — one line of a vendor payment's Activity, newest first. */
export interface VendorPaymentActivityEntry {
  type: "recorded" | "applied" | "remittance_emailed";
  at: string;
  actorName: string | null;
  /** Minor units: the payment's amount, or what it put on a bill. */
  amount?: string | null;
  /** The bill's number, or the address a remittance advice went to. */
  detail?: string | null;
  /** The bill, for `applied`. */
  linkId?: string | null;
  /** The money account, for `recorded`. */
  account?: string | null;
  /** The method, for `recorded`. */
  method?: string | null;
}

/** US-PUR-53 — `GET /vendor-payments/possible-duplicates`. */
export interface PossibleDuplicateVendorPayment {
  id: string;
  number: string | null;
  date: string;
  amount: string;
  currency: string;
  method: string;
  reference: string | null;
}

/** US-PUR-51 — `GET /vendor-payments/summary`, in the business's currency (minor units). */
export interface VendorPaymentsSummary {
  currency: string;
  paidThisMonth: string;
  paidThisMonthCount: number;
  paidLastMonth: string;
  paidLastMonthCount: number;
  toPay: string;
  toPayCount: number;
}

/** US-PUR-54 — `POST /vendor-payments/:id/remittance/send`. */
export const sendRemittanceSchema = z.object({
  to: z.string().trim().email("Enter an email address to send the remittance advice to."),
  subject: z.string().trim().min(1, "Give the email a subject.").max(200, "Keep the subject shorter."),
  body: z.string().trim().min(1, "Write a short message.").max(20000, "Keep the message shorter."),
});
export type SendRemittanceInput = z.infer<typeof sendRemittanceSchema>;

