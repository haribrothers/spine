export type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

export interface ReceivablesInvoiceRow {
  id: string;
  number: string | null;
  contactId: string;
  contactName: string | null;
  currency: string;
  dueDate: string | null;
  totalAmount: string;
  balanceDue: string;
  daysOverdue: number;
  bucket: AgingBucket;
  /** US-PAY-30 (D-224). */
  issueDate: string | null;
  type: string;
  paidAmount: string;
  jobId: string | null;
  jobName: string | null;
  lastReminderOn: string | null;
  remindedToday: boolean;
  contactHasEmail: boolean;
}

/** US-PAY-27 — one customer who owes (GET /reports/receivables `customers`). */
export interface ReceivablesCustomerRow {
  contactId: string;
  name: string | null;
  email: string | null;
  invoiceCount: number;
  overdueAmount: string;
  totalOutstanding: string;
  oldestDaysOverdue: number;
  credit: string;
  lastReminderOn: string | null;
}

export interface ReceivablesReport {
  asOf: string;
  totalOutstanding: string;
  buckets: Record<AgingBucket, string>;
  invoices: ReceivablesInvoiceRow[];
  customers: ReceivablesCustomerRow[];
  /** US-PAY-31 — retention held on jobs, never in the aging. */
  retention: { held: string; jobCount: number };
}

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "0-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};
