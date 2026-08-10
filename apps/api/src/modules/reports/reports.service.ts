import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { invoices, invoiceLines, contacts, accounts, journalEntries, journalLines, taxRates, taxGroups, vendorBills } from "../../db/schema";

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
}

export interface PayablesReport {
  asOf: string;
  totalOutstanding: string;
  buckets: Record<AgingBucket, string>;
  bills: PayablesBillRow[];
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

  /**
   * S-07.7 — payables with the same 0-30/31-60/61-90/90+ aging buckets as
   * `receivables()` above, mirroring its exact reasoning: reads directly
   * off `vendor_bills` (which already carries the authoritative running
   * `amountPaid`, kept in sync by `VendorPaymentsService`) rather than
   * re-deriving balances from `journal_lines`, same "don't maintain a
   * parallel payables table" interpretation of CLAUDE.md's ledger-derived-
   * reporting rule. Only `recorded` bills with a positive balance are
   * included — draft/void bills were never payable and paid-in-full ones
   * have nothing outstanding.
   */
  async payables(orgId: string): Promise<PayablesReport> {
    const rows = await this.db
      .select({ bill: vendorBills, contactName: contacts.name })
      .from(vendorBills)
      .leftJoin(contacts, eq(vendorBills.contactId, contacts.id))
      .where(and(eq(vendorBills.orgId, orgId), eq(vendorBills.status, "recorded")));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buckets: Record<AgingBucket, bigint> = {
      current: 0n,
      "0-30": 0n,
      "31-60": 0n,
      "61-90": 0n,
      "90+": 0n,
    };

    const billRows: PayablesBillRow[] = [];
    let totalOutstanding = 0n;

    for (const row of rows) {
      const balanceDue = row.bill.totalAmount - row.bill.amountPaid;
      if (balanceDue <= 0n) continue;

      const daysOverdue = daysPastDue(row.bill.dueDate, today);
      const bucket = bucketFor(daysOverdue);

      buckets[bucket] += balanceDue;
      totalOutstanding += balanceDue;

      billRows.push({
        id: row.bill.id,
        billNumber: row.bill.billNumber,
        contactId: row.bill.contactId,
        contactName: row.contactName,
        currency: row.bill.currency,
        dueDate: row.bill.dueDate ? new Date(row.bill.dueDate).toISOString().slice(0, 10) : null,
        totalAmount: row.bill.totalAmount.toString(),
        balanceDue: balanceDue.toString(),
        daysOverdue,
        bucket,
      });
    }

    billRows.sort((a, b) => b.daysOverdue - a.daysOverdue);

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
      bills: billRows,
    };
  }

  /**
   * S-08.4 — tax collected vs. tax paid for a date range, "so filing is a
   * data-entry job, not an investigation." Per CLAUDE.md/FEAT-09's own
   * acceptance highlight ("no report is computed from documents directly —
   * all financial reporting derives from journal lines"), this sums
   * `journal_lines` credits/debits against the two system tax accounts
   * seeded by `chart-of-accounts.ts` — `2100 Output Tax Payable` (credited
   * when an invoice is issued, per §7.2 "Invoice issued") for tax
   * collected, and `1200 Input Tax Receivable` (debited when a vendor bill
   * is recorded, per §7.2 "Vendor bill recorded") for tax paid. Vendor
   * bills don't exist until FEAT-07 lands, so `taxPaid` is always 0 today —
   * this query needs no rework once they do, same forward-compatible
   * shape `JobCostingService`'s own revenue/cost split already established.
   * Bounded by `journal_entries.date` (the business event's date, not
   * `createdAt`), inclusive on both ends.
   *
   * `collectedByRate` is the per-rate/group breakdown a real VAT/GST return
   * usually needs (e.g. "how much collected at 20% vs. at 5%") — this part
   * necessarily reads `invoice_lines` rather than `journal_lines`, since a
   * ledger posting is one blended amount per document with no per-rate
   * split. Grouped by `taxRateId`/`taxGroupId` (falling back to the flat
   * `taxRatePercentage` for pre-FEAT-08 lines that have neither), scoped to
   * `status = "issued"` invoices with `issueDate` in range — a voided
   * invoice's status flips to `void` (never `issued`), so this naturally
   * excludes voids without needing the ledger's reversing-entry netting
   * trick `taxCollected`/`taxPaid` above rely on. There is currently no
   * paid-side (input tax) equivalent breakdown since vendor bill lines
   * don't exist until FEAT-07 — same "always 0 until Purchases lands"
   * caveat as `taxPaid` itself.
   *
   * IMPORTANT: `collectedByRate`'s rows will NOT always sum to
   * `taxCollected` above, and that's correct, not a bug — the two read
   * different sources of truth on purpose. `taxCollected` is the ledger
   * (`journal_lines`), which is genuinely permanent per CLAUDE.md ("issued
   * financial documents are never edited or deleted") and can include
   * postings whose originating `invoices` row is gone (e.g. a demo invoice
   * removed by `DemoDataService.deleteAll`, which deletes the invoice
   * document but never touches its already-posted ledger history — the
   * same "referenced ledger history survives document deletion" principle
   * `deleteAll`'s own comment already documents for contacts/jobs).
   * `collectedByRate` reads `invoice_lines`, which only reflects
   * currently-existing invoices. A mismatch here means old/removed
   * invoices' tax is still sitting in the ledger with no live document to
   * attribute it to by rate — worth surfacing to the user as "N in
   * unattributed history" rather than silently forcing the breakdown to
   * sum to the ledger total, which would misrepresent which real,
   * currently-visible invoices produced which rate's revenue.
   */
  async taxSummary(orgId: string, from: string, to: string): Promise<TaxSummaryReport> {
    const [outputTaxAccount] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, "2100")));
    const [inputTaxAccount] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.code, "1200")));

    const collectedRows = outputTaxAccount
      ? await this.db
          .select({ line: journalLines, entry: journalEntries })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(
            and(
              eq(journalEntries.orgId, orgId),
              eq(journalLines.accountId, outputTaxAccount.id),
              gte(journalEntries.date, from),
              lte(journalEntries.date, to),
            ),
          )
      : [];

    const paidRows = inputTaxAccount
      ? await this.db
          .select({ line: journalLines, entry: journalEntries })
          .from(journalLines)
          .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
          .where(
            and(
              eq(journalEntries.orgId, orgId),
              eq(journalLines.accountId, inputTaxAccount.id),
              gte(journalEntries.date, from),
              lte(journalEntries.date, to),
            ),
          )
      : [];

    // Credits increase Output Tax Payable (tax collected); a reversing
    // entry (void) posts an offsetting debit, so summing credit - debit
    // nets out voided invoices automatically rather than double-counting.
    const taxCollected = collectedRows.reduce((sum, r) => sum + r.line.credit - r.line.debit, 0n);
    // Debits increase Input Tax Receivable (tax paid) — same net convention.
    const taxPaid = paidRows.reduce((sum, r) => sum + r.line.debit - r.line.credit, 0n);

    const collectedByRate = await this.taxCollectedByRate(orgId, from, to);
    const attributedTotal = collectedByRate.reduce((sum, r) => sum + BigInt(r.amount), 0n);
    // See taxSummary's own doc comment on why these can legitimately
    // differ — surfaced explicitly rather than silently letting the
    // breakdown under-total the ledger figure with no explanation.
    const unattributed = taxCollected - attributedTotal;
    if (unattributed !== 0n) {
      collectedByRate.push({ name: "Other / from removed invoices", percentage: 0, amount: unattributed.toString() });
    }

    return {
      from,
      to,
      taxCollected: taxCollected.toString(),
      taxPaid: taxPaid.toString(),
      netTaxPayable: (taxCollected - taxPaid).toString(),
      collectedByRate,
    };
  }

  private async taxCollectedByRate(orgId: string, from: string, to: string): Promise<TaxByRateRow[]> {
    const lineRows = await this.db
      .select({ line: invoiceLines })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.orgId, orgId),
          eq(invoices.status, "issued"),
          gte(invoices.issueDate, new Date(from)),
          lte(invoices.issueDate, new Date(to)),
        ),
      );

    const taxRateIds = Array.from(new Set(lineRows.map((r) => r.line.taxRateId).filter((id): id is string => Boolean(id))));
    const taxGroupIds = Array.from(new Set(lineRows.map((r) => r.line.taxGroupId).filter((id): id is string => Boolean(id))));

    const rateNames = taxRateIds.length
      ? await this.db.select({ id: taxRates.id, name: taxRates.name }).from(taxRates).where(inArray(taxRates.id, taxRateIds))
      : [];
    const groupNames = taxGroupIds.length
      ? await this.db.select({ id: taxGroups.id, name: taxGroups.name }).from(taxGroups).where(inArray(taxGroups.id, taxGroupIds))
      : [];
    const rateNameById = new Map(rateNames.map((r) => [r.id, r.name]));
    const groupNameById = new Map(groupNames.map((g) => [g.id, g.name]));

    const buckets = new Map<string, { key: string; name: string; percentage: number; amount: bigint }>();
    for (const { line } of lineRows) {
      if (line.lineTaxAmount === 0n) continue;

      let key: string;
      let name: string;
      if (line.taxRateId) {
        key = `rate:${line.taxRateId}`;
        name = rateNameById.get(line.taxRateId) ?? "Deleted rate";
      } else if (line.taxGroupId) {
        key = `group:${line.taxGroupId}`;
        name = groupNameById.get(line.taxGroupId) ?? "Deleted group";
      } else {
        key = `flat:${line.taxRatePercentage}`;
        name = `${line.taxRatePercentage}% tax`;
      }

      const existing = buckets.get(key);
      if (existing) {
        existing.amount += line.lineTaxAmount;
      } else {
        buckets.set(key, { key, name, percentage: line.taxRatePercentage, amount: line.lineTaxAmount });
      }
    }

    return Array.from(buckets.values())
      .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
      .map((b) => ({ name: b.name, percentage: b.percentage, amount: b.amount.toString() }));
  }
}

export interface TaxByRateRow {
  /** The tax rate/group's own name, or "X% tax" for a pre-FEAT-08 line with only a flat percentage, or "Deleted rate"/"Deleted group" if the referenced row was since hard-deleted. */
  name: string;
  /** Blended percentage — see invoice_lines.taxRatePercentage's own comment. */
  percentage: number;
  amount: string;
}

export interface TaxSummaryReport {
  from: string;
  to: string;
  /** Sum of Output Tax Payable postings in the period — tax charged to customers. */
  taxCollected: string;
  /** Sum of Input Tax Receivable postings in the period — tax paid to vendors. Always "0" until FEAT-07 vendor bills exist. */
  taxPaid: string;
  netTaxPayable: string;
  /**
   * Tax collected broken down by rate/group, largest first. Always sums
   * exactly to `taxCollected` — if the ledger includes postings from
   * invoices that no longer exist as documents (see `taxSummary`'s own
   * doc comment), the remainder is surfaced as a trailing "Other / from
   * removed invoices" row rather than silently making the breakdown
   * under-total the ledger figure. Empty array only when `taxCollected`
   * is itself "0".
   */
  collectedByRate: TaxByRateRow[];
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
