import { z } from "zod";
import { currencyCodeSchema, uuidSchema } from "./common.ts";

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
});

/** A draft-only update — see VendorBillsService.update's own guard against editing a recorded bill. */
export const updateVendorBillSchema = createVendorBillSchema.partial();

/** Void requires a reason, mirroring voidInvoiceSchema exactly. */
export const voidVendorBillSchema = z.object({
  reason: z.string().min(1, "A reason is required to void a vendor bill"),
});

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1),
  accountId: uuidSchema.optional().nullable(),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial();

export const expensePaidBySchema = z.enum(["company", "employee"]);

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
});

/** A submitted-only update — see ExpensesService.update's own guard against editing a reviewed expense. */
export const updateExpenseSchema = createExpenseSchema.partial();

/** S-07.4 — reject requires a comment; approve's comment is optional. */
export const reviewExpenseSchema = z.object({
  comment: z.string().optional().nullable(),
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
  allocations: z.array(vendorPaymentAllocationInputSchema).min(1),
});
