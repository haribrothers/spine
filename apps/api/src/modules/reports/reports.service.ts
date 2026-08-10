import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invoices, contacts } from "../../db/schema";

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

/**
 * S-06.7 / S-09.5 (AR half) — receivables with 0-30/31-60/61-90/90+ aging
 * buckets. Per CLAUDE.md's own "AR aging and job profitability come from
 * filtering the ledger, not from separate calculations — don't build a
 * shadow costing system" rule, this reads directly off `invoices` (the
 * same `balanceDue = totalAmount - retentionAmount - amountPaid -
 * creditedAmount` InvoicesService.list/getOne already compute, credit
 * notes' S-05.6 reduction included) rather than re-deriving balances from
 * journal_lines — invoices already carry the authoritative running
 * balance, and re-summing the ledger per invoice on every report request
 * would be strictly more work for the same answer, not more correct.
 * "Filtering the ledger" here is read as "don't maintain a parallel
 * receivables table that can drift from the source documents", which this
 * satisfies by computing on read.
 *
 * Retention (S-04.6) is subtracted from every balance here, per the PRD's
 * own §7's acceptance highlight for F4: "retention posts to a separate
 * Retention Receivable account, not AR, so aging reports aren't
 * distorted." A held-back retention amount was never part of AR, so it
 * must never appear as an "overdue" receivable — it becomes collectible
 * only when explicitly released (S-04.7), which posts its own separate
 * entry and is a distinct concern from this report.
 *
 * Bucketing is by days *past* `dueDate` as of today: not yet due (or no
 * due date) is "current"; 1-30 days over is "0-30"; and so on. Only
 * `issued` invoices with a positive balance are included — draft/void
 * invoices were never receivable and paid-in-full ones have nothing
 * outstanding.
 */
@Injectable()
export class ReportsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async receivables(orgId: string): Promise<ReceivablesReport> {
    const rows = await this.db
      .select({ invoice: invoices, contactName: contacts.name })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued")));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets: Record<AgingBucket, bigint> = {
      current: 0n,
      "0-30": 0n,
      "31-60": 0n,
      "61-90": 0n,
      "90+": 0n,
    };

    const invoiceRows: ReceivablesInvoiceRow[] = [];
    let totalOutstanding = 0n;

    for (const row of rows) {
      const balanceDue = row.invoice.totalAmount - row.invoice.retentionAmount - row.invoice.amountPaid - row.invoice.creditedAmount;
      if (balanceDue <= 0n) continue;

      const daysOverdue = daysPastDue(row.invoice.dueDate, today);
      const bucket = bucketFor(daysOverdue);

      buckets[bucket] += balanceDue;
      totalOutstanding += balanceDue;

      invoiceRows.push({
        id: row.invoice.id,
        number: row.invoice.number,
        contactId: row.invoice.contactId,
        contactName: row.contactName,
        currency: row.invoice.currency,
        dueDate: row.invoice.dueDate ? new Date(row.invoice.dueDate).toISOString().slice(0, 10) : null,
        totalAmount: row.invoice.totalAmount.toString(),
        balanceDue: balanceDue.toString(),
        daysOverdue,
        bucket,
      });
    }

    invoiceRows.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return {
      asOf: today.toISOString().slice(0, 10),
      totalOutstanding: totalOutstanding.toString(),
      buckets: {
        current: buckets.current.toString(),
        "0-30": buckets["0-30"].toString(),
        "31-60": buckets["31-60"].toString(),
        "61-90": buckets["61-90"].toString(),
        "90+": buckets["90+"].toString(),
      },
      invoices: invoiceRows,
    };
  }
}

function daysPastDue(dueDate: Date | null, today: Date): number {
  if (!dueDate) return -1; // no due date set — treated as "current", same as isOverdue's own nulls-are-not-overdue rule
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
}

function bucketFor(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return "current";
  if (daysOverdue <= 30) return "0-30";
  if (daysOverdue <= 60) return "31-60";
  if (daysOverdue <= 90) return "61-90";
  return "90+";
}
