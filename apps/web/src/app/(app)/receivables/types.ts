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
}

export interface ReceivablesReport {
  asOf: string;
  totalOutstanding: string;
  buckets: Record<AgingBucket, string>;
  invoices: ReceivablesInvoiceRow[];
}

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: "Current",
  "0-30": "1–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};
