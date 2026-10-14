import { z } from "zod";
import { uuidSchema } from "./common.ts";

/** D-097 — bulk actions take at most 100 records. */
export const BULK_MAX = 100;

/** `POST …/bulk/*` — the records to act on. */
export const bulkIdsSchema = z.object({
  ids: z.array(uuidSchema).min(1, "Select at least one record.").max(BULK_MAX, `Select ${BULK_MAX} or fewer.`),
});

/** Invoices word the limit their own way (US-INV-24). */
export const bulkInvoiceIdsSchema = z.object({
  ids: z.array(uuidSchema).min(1, "Select at least one invoice.").max(BULK_MAX, `Select ${BULK_MAX} or fewer invoices.`),
});

/** US-PUR-36 — recording several draft vendor bills at once. */
export const bulkVendorBillIdsSchema = z.object({
  ids: z.array(uuidSchema).min(1, "Select at least one bill.").max(BULK_MAX, `Select ${BULK_MAX} or fewer bills.`),
});

/** US-PUR-41 — recording several draft vendor credits at once. */
export const bulkVendorCreditIdsSchema = z.object({
  ids: z.array(uuidSchema).min(1, "Select at least one credit.").max(BULK_MAX, `Select ${BULK_MAX} or fewer credits.`),
});

/** US-PUR-21 — rejecting several expenses: one comment for all of them. */
export const bulkRejectSchema = bulkIdsSchema.extend({
  comment: z.string().trim().min(1, "Add a comment — it's sent with every rejected expense."),
});

/** D-097 — every bulk action reports what it did and every record it skipped, with the reason. */
export interface BulkResult {
  done: string[];
  skipped: { id: string; label: string | null; reason: string }[];
}
