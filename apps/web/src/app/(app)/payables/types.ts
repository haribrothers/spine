export type AgingBucket = "current" | "0-30" | "31-60" | "61-90" | "90+";

export interface PayablesBillRow {
  id: string;
  billNumber: string;
  contactId: string;
  contactName: string | null;
  currency: string;
  dueDate: string | null;
  totalAmount: string;
  balanceDue: string;
  daysOverdue: number;
  bucket: AgingBucket;
  /** US-PUR-57 — the bill date, what's been paid and credited, and the job. */
  date: string;
  paidAmount: string;
  jobId: string | null;
  jobName: string | null;
}

/** US-PUR-56 — one vendor we owe. */
export interface PayablesVendorRow {
  contactId: string;
  name: string | null;
  billCount: number;
  overdueAmount: string;
  totalOutstanding: string;
  oldestDaysOverdue: number;
  oldestDueDate: string | null;
  credit: string;
  lastPaidOn: string | null;
}

export interface PayablesReport {
  asOf: string;
  totalOutstanding: string;
  buckets: Record<AgingBucket, string>;
  bills: PayablesBillRow[];
  vendors: PayablesVendorRow[];
  dueSoon: { amount: string; count: number };
  drafts: { count: number; amount: string };
}

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "0-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};
