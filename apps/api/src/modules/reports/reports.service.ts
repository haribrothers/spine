import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import {
  invoices,
  invoiceLines,
  contacts,
  accounts,
  journalEntries,
  journalLines,
  taxRates,
  taxGroups,
  vendorBills,
  jobs,
  creditNotes,
} from "../../db/schema";

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
    const attributedTax = collectedByRate.reduce((sum, r) => sum + BigInt(r.amount), 0n);
    const attributedTaxable = collectedByRate.reduce((sum, r) => sum + BigInt(r.taxableAmount), 0n);

    // US-RPT-14: the per-rate rows cover invoices issued in the period. What
    // the ledger also holds — credit notes, invoices voided in the period
    // after being issued earlier, and postings whose documents were since
    // removed — is one "adjustments" row, so the table always totals the
    // ledger's tax collected.
    const adjustmentTax = taxCollected - attributedTax;
    const adjustmentTaxable = await this.taxableAdjustments(orgId, from, to);
    const adjustments =
      adjustmentTax !== 0n || adjustmentTaxable !== 0n ? { taxableAmount: adjustmentTaxable.toString(), amount: adjustmentTax.toString() } : null;

    return {
      from,
      to,
      taxCollected: taxCollected.toString(),
      taxPaid: taxPaid.toString(),
      netTaxPayable: (taxCollected - taxPaid).toString(),
      collectedByRate,
      adjustments,
      totalTaxable: (attributedTaxable + adjustmentTaxable).toString(),
    };
  }

  /**
   * S-09.2 — Profit & Loss for any date range. Per CLAUDE.md/FEAT-09's
   * "no report is computed from documents directly — all financial
   * reporting derives from journal lines" rule, this sums `journal_lines`
   * grouped by account, bounded by `journal_entries.date` (the business
   * event's date, inclusive both ends — same convention as `taxSummary`).
   * Income accounts' net is credit-debit (a credit increases income);
   * expense accounts' net is debit-credit (a debit increases expense) —
   * standard trial-balance sign convention. A void's reversing entry nets
   * out automatically since it's just more journal lines on the same
   * accounts, not a special case here.
   */
  async profitAndLoss(orgId: string, from: string, to: string): Promise<ProfitAndLossReport> {
    const rows = await this.db
      .select({ accountId: journalLines.accountId, debit: journalLines.debit, credit: journalLines.credit, account: accounts })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, from),
          lte(journalEntries.date, to),
          inArray(accounts.type, ["income", "expense"]),
        ),
      );

    const byAccount = new Map<string, { code: string; name: string; type: "income" | "expense"; amount: bigint }>();
    for (const row of rows) {
      const existing = byAccount.get(row.accountId);
      const delta = row.account.type === "income" ? row.credit - row.debit : row.debit - row.credit;
      if (existing) {
        existing.amount += delta;
      } else {
        byAccount.set(row.accountId, { code: row.account.code, name: row.account.name, type: row.account.type as "income" | "expense", amount: delta });
      }
    }

    const income: ReportAccountLine[] = [];
    const expenses: ReportAccountLine[] = [];
    let totalIncome = 0n;
    let totalExpenses = 0n;
    for (const [id, acc] of byAccount) {
      const line: ReportAccountLine = { accountId: id, code: acc.code, name: acc.name, amount: acc.amount.toString() };
      if (acc.type === "income") {
        totalIncome += acc.amount;
        income.push(line);
      } else {
        totalExpenses += acc.amount;
        expenses.push(line);
      }
    }
    income.sort((a, b) => a.code.localeCompare(b.code));
    expenses.sort((a, b) => a.code.localeCompare(b.code));

    return {
      from,
      to,
      income,
      expenses,
      totalIncome: totalIncome.toString(),
      totalExpenses: totalExpenses.toString(),
      netProfit: (totalIncome - totalExpenses).toString(),
    };
  }

  /**
   * S-09.3 — Balance Sheet as of a given date. Assets/liabilities/equity
   * balances are each accounts' lifetime net movement up to and including
   * `asOf` (a balance sheet is a point-in-time snapshot, unlike P&L's
   * ranged flow), same journal_lines-derived approach as every other
   * report here. Asset accounts net debit-credit (a debit increases an
   * asset); liability/equity accounts net credit-debit — standard
   * convention, mirroring `profitAndLoss`'s own income/expense split.
   *
   * Current-period net profit (income minus expense for the same
   * lifetime-to-`asOf` window) is folded into equity as an explicit
   * "Retained Earnings (current period)" line rather than written to the
   * `3200 Retained Earnings` system account — that account exists for a
   * future formal period-close/roll-forward step (S-09.8 closes a period
   * for editing, it doesn't currently post a closing entry), so showing
   * current earnings as a computed line here means the balance sheet
   * balances (assets == liabilities + equity) without inventing a posting
   * this codebase doesn't otherwise make.
   */
  /**
   * US-RPT-13 (D-065) — every account's balance as of a date, read from
   * journal lines: a net debit shows in Debit, a net credit in Credit.
   * Zero-balance accounts are left out unless `includeZero`. The totals
   * match whenever the ledger balances, which the database guarantees.
   */
  async trialBalance(orgId: string, asOf: string, includeZero = false): Promise<TrialBalanceReport> {
    const balances = await this.db
      .select({
        accountId: accounts.id,
        code: accounts.code,
        name: accounts.name,
        balance: sql<string>`coalesce(sum(${journalLines.debit} - ${journalLines.credit}) filter (where ${journalEntries.date} <= ${asOf}), 0)`,
      })
      .from(accounts)
      .leftJoin(journalLines, eq(journalLines.accountId, accounts.id))
      .leftJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(eq(accounts.orgId, orgId))
      .groupBy(accounts.id, accounts.code, accounts.name)
      .orderBy(accounts.code);

    let totalDebit = 0n;
    let totalCredit = 0n;
    const lines: TrialBalanceLine[] = [];
    for (const row of balances) {
      const balance = BigInt(row.balance);
      if (balance === 0n && !includeZero) continue;
      const debit = balance > 0n ? balance : 0n;
      const credit = balance < 0n ? -balance : 0n;
      totalDebit += debit;
      totalCredit += credit;
      lines.push({ accountId: row.accountId, code: row.code, name: row.name, debit: debit.toString(), credit: credit.toString() });
    }
    return { asOf, lines, totalDebit: totalDebit.toString(), totalCredit: totalCredit.toString(), balanced: totalDebit === totalCredit };
  }

  async balanceSheet(orgId: string, asOf: string): Promise<BalanceSheetReport> {
    const rows = await this.db
      .select({ accountId: journalLines.accountId, debit: journalLines.debit, credit: journalLines.credit, account: accounts })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(journalEntries.orgId, orgId), lte(journalEntries.date, asOf)));

    const byAccount = new Map<string, { code: string; name: string; type: string; amount: bigint }>();
    for (const row of rows) {
      const isDebitNormal = row.account.type === "asset" || row.account.type === "expense";
      const delta = isDebitNormal ? row.debit - row.credit : row.credit - row.debit;
      const existing = byAccount.get(row.accountId);
      if (existing) {
        existing.amount += delta;
      } else {
        byAccount.set(row.accountId, { code: row.account.code, name: row.account.name, type: row.account.type, amount: delta });
      }
    }

    const assets: ReportAccountLine[] = [];
    const liabilities: ReportAccountLine[] = [];
    const equity: ReportAccountLine[] = [];
    let totalAssets = 0n;
    let totalLiabilities = 0n;
    let totalEquity = 0n;
    let netIncome = 0n;

    for (const [id, acc] of byAccount) {
      const line: ReportAccountLine = { accountId: id, code: acc.code, name: acc.name, amount: acc.amount.toString() };
      if (acc.type === "asset") {
        totalAssets += acc.amount;
        assets.push(line);
      } else if (acc.type === "liability") {
        totalLiabilities += acc.amount;
        liabilities.push(line);
      } else if (acc.type === "equity") {
        totalEquity += acc.amount;
        equity.push(line);
      } else if (acc.type === "income") {
        netIncome += acc.amount;
      } else if (acc.type === "expense") {
        netIncome -= acc.amount;
      }
    }

    equity.push({ accountId: undefined, code: "3200", name: "Retained Earnings (current period)", amount: netIncome.toString() });
    totalEquity += netIncome;

    assets.sort((a, b) => a.code.localeCompare(b.code));
    liabilities.sort((a, b) => a.code.localeCompare(b.code));
    equity.sort((a, b) => a.code.localeCompare(b.code));

    return {
      asOf,
      assets,
      liabilities,
      equity,
      totalAssets: totalAssets.toString(),
      totalLiabilities: totalLiabilities.toString(),
      totalEquity: totalEquity.toString(),
      totalLiabilitiesAndEquity: (totalLiabilities + totalEquity).toString(),
    };
  }

  /**
   * S-09.4 — "click any figure in a report and see the documents behind
   * it." Given an account + date range (the exact inputs `profitAndLoss`/
   * `balanceSheet` already group by), returns every journal entry posted
   * to that account in range with its `sourceType`/`sourceId` — the web
   * client resolves that into a real link (e.g. `sourceType: "invoice"` ->
   * `/invoices/:sourceId`) since this service has no reason to know every
   * consuming module's own route shape. `narration` is included as a
   * human-readable fallback for source types the client doesn't have a
   * dedicated link for.
   */
  async accountDrilldown(orgId: string, accountId: string, from: string, to: string): Promise<AccountDrilldownReport> {
    const [account] = await this.db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.id, accountId)));
    if (!account) {
      return { accountId, accountCode: "", accountName: "", from, to, entries: [] };
    }

    const rows = await this.db
      .select({ entry: journalEntries, line: journalLines })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          eq(journalLines.accountId, accountId),
          gte(journalEntries.date, from),
          lte(journalEntries.date, to),
        ),
      );

    const entries: AccountDrilldownEntry[] = rows
      .map((row) => ({
        journalEntryId: row.entry.id,
        date: row.entry.date,
        narration: row.entry.narration,
        sourceType: row.entry.sourceType,
        sourceId: row.entry.sourceId,
        debit: row.line.debit.toString(),
        credit: row.line.credit.toString(),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { accountId, accountCode: account.code, accountName: account.name, from, to, entries };
  }

  /**
   * S-09.6 — job profitability across ALL jobs, the all-jobs summary view
   * `JobCostingService.report` (per-job, Phase 3) doesn't provide. Reuses
   * the exact same journal_lines-filtered-by-jobId approach — grouped by
   * `jobId` in one query instead of N — never a shadow costing table, same
   * as that service's own doc comment.
   */
  async jobProfitability(orgId: string): Promise<JobProfitabilityReport> {
    const jobRows = await this.db.select().from(jobs).where(eq(jobs.orgId, orgId));
    const rows = await this.db
      .select({ jobId: journalLines.jobId, debit: journalLines.debit, credit: journalLines.credit, accountType: accounts.type })
      .from(journalLines)
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .where(and(eq(journalEntries.orgId, orgId), inArray(accounts.type, ["income", "expense"])));

    const byJob = new Map<string, { revenue: bigint; cost: bigint }>();
    for (const row of rows) {
      if (!row.jobId) continue;
      const existing = byJob.get(row.jobId) ?? { revenue: 0n, cost: 0n };
      if (row.accountType === "income") existing.revenue += row.credit;
      if (row.accountType === "expense") existing.cost += row.debit;
      byJob.set(row.jobId, existing);
    }

    const jobRowsReport: JobProfitabilityRow[] = jobRows.map((job) => {
      const totals = byJob.get(job.id) ?? { revenue: 0n, cost: 0n };
      const margin = totals.revenue - totals.cost;
      const marginPct = totals.revenue > 0n ? Number((margin * 10000n) / totals.revenue) / 100 : null;
      return {
        jobId: job.id,
        name: job.name,
        status: job.status,
        currency: job.currency,
        contractValueAmount: job.contractValueAmount.toString(),
        revenue: totals.revenue.toString(),
        cost: totals.cost.toString(),
        margin: margin.toString(),
        marginPct,
      };
    });

    jobRowsReport.sort((a, b) => (BigInt(b.margin) > BigInt(a.margin) ? 1 : BigInt(b.margin) < BigInt(a.margin) ? -1 : 0));

    return { jobs: jobRowsReport };
  }

  /**
   * S-09.10 — "a dashboard with cash position, receivables, overdue count
   * and month revenue, so one screen tells me how things stand." Reuses
   * `receivables()` for the AR figures (same balance computation, no
   * second source of truth); cash position sums the two seeded cash/bank
   * asset accounts' (`1000`/`1010`) lifetime net movement, same
   * debit-increases-asset convention as `balanceSheet`; month revenue sums
   * `income`-type journal_lines credits for the current calendar month
   * to date, same convention as `profitAndLoss`.
   */
  async dashboardSummary(orgId: string): Promise<DashboardSummaryReport> {
    const receivables = await this.receivables(orgId);
    const overdueCount = receivables.invoices.filter((i) => i.bucket !== "current").length;

    const cashAccounts = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), inArray(accounts.code, ["1000", "1010"])));
    const cashAccountIds = cashAccounts.map((a) => a.id);
    const cashLines = cashAccountIds.length
      ? await this.db.select({ debit: journalLines.debit, credit: journalLines.credit }).from(journalLines).where(inArray(journalLines.accountId, cashAccountIds))
      : [];
    const cashPosition = cashLines.reduce((sum, l) => sum + l.debit - l.credit, 0n);

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const todayStr = now.toISOString().slice(0, 10);
    const monthRevenueRows = await this.db
      .select({ debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(journalEntries.orgId, orgId), eq(accounts.type, "income"), gte(journalEntries.date, monthStart), lte(journalEntries.date, todayStr)));
    const monthRevenue = monthRevenueRows.reduce((sum, l) => sum + l.credit - l.debit, 0n);

    return {
      cashPosition: cashPosition.toString(),
      totalReceivables: receivables.totalOutstanding,
      overdueInvoiceCount: overdueCount,
      monthRevenue: monthRevenue.toString(),
    };
  }

  /**
   * S-09.11 (dashboard v2) — revenue trend chart, trailing N months
   * (3/6/12). Same journal_lines-income-credits source as
   * `dashboardSummary`'s `monthRevenue`, generalized from "this month
   * only" to N calendar months. One query for the whole window, then
   * grouped by month in application code — simpler than N separate
   * date-range queries, and a year of journal activity is small enough
   * that grouping in JS costs nothing meaningful.
   */
  async revenueTrend(orgId: string, months: 3 | 6 | 12): Promise<RevenueTrendReport> {
    const now = new Date();
    const windowStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const windowStartStr = windowStart.toISOString().slice(0, 10);
    const todayStr = now.toISOString().slice(0, 10);

    const rows = await this.db
      .select({ date: journalEntries.date, debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(journalEntries.orgId, orgId), eq(accounts.type, "income"), gte(journalEntries.date, windowStartStr), lte(journalEntries.date, todayStr)));

    const byMonth = new Map<string, bigint>();
    for (let i = 0; i < months; i++) {
      const d = new Date(windowStart.getFullYear(), windowStart.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonth.set(key, 0n);
    }
    for (const row of rows) {
      const key = row.date.slice(0, 7);
      const existing = byMonth.get(key);
      if (existing !== undefined) {
        byMonth.set(key, existing + row.credit - row.debit);
      }
    }

    return {
      months: Array.from(byMonth.entries()).map(([month, revenue]) => ({ month, revenue: revenue.toString() })),
    };
  }

  /**
   * S-09.12 (dashboard v2) — "invoices due this week" widget. A thin
   * filter over `receivables()`'s already-computed, already-balance-
   * correct invoice list — not a new balance computation. "This week"
   * means the next 7 days from today, inclusive, matching the widget's
   * own PRD wording ("invoices due within the next 7 days").
   */
  async invoicesDueThisWeek(orgId: string): Promise<ReceivablesInvoiceRow[]> {
    const report = await this.receivables(orgId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 7);
    const todayStr = today.toISOString().slice(0, 10);
    const horizonStr = horizon.toISOString().slice(0, 10);

    return report.invoices
      .filter((invoice) => invoice.dueDate !== null && invoice.dueDate >= todayStr && invoice.dueDate <= horizonStr)
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }

  /** Taxable amounts taken back in the period: credit notes issued, and invoices issued before it but voided in it. */
  private async taxableAdjustments(orgId: string, from: string, to: string): Promise<bigint> {
    const toEnd = `${to}T23:59:59.999Z`;
    const [credited] = await this.db
      .select({ total: sql<string>`coalesce(sum(${creditNotes.subtotalAmount}), 0)` })
      .from(creditNotes)
      .where(
        and(eq(creditNotes.orgId, orgId), eq(creditNotes.status, "issued"), gte(creditNotes.issuedAt, new Date(from)), lte(creditNotes.issuedAt, new Date(toEnd))),
      );
    const [voided] = await this.db
      .select({ total: sql<string>`coalesce(sum(${invoices.subtotalAmount} - ${invoices.discountAmount}), 0)` })
      .from(invoices)
      .where(
        and(
          eq(invoices.orgId, orgId),
          eq(invoices.status, "void"),
          gte(invoices.voidedAt, new Date(from)),
          lte(invoices.voidedAt, new Date(toEnd)),
          sql`${invoices.issueDate} < ${from}`,
        ),
      );
    return -(BigInt(credited?.total ?? "0") + BigInt(voided?.total ?? "0"));
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

    const buckets = new Map<string, { key: string; name: string; percentage: number; taxable: bigint; amount: bigint }>();
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
        existing.taxable += line.lineSubtotalAmount;
      } else {
        buckets.set(key, { key, name, percentage: line.taxRatePercentage, taxable: line.lineSubtotalAmount, amount: line.lineTaxAmount });
      }
    }

    return Array.from(buckets.values())
      .sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0))
      .map((b) => ({ name: b.name, percentage: b.percentage, taxableAmount: b.taxable.toString(), amount: b.amount.toString() }));
  }
}

export interface TaxByRateRow {
  /** The tax rate/group's own name, or "X% tax" for a pre-FEAT-08 line with only a flat percentage, or "Deleted rate"/"Deleted group" if the referenced row was since hard-deleted. */
  name: string;
  /** Blended percentage — see invoice_lines.taxRatePercentage's own comment. */
  percentage: number;
  /** Net (pre-tax) amount of the lines taxed at this rate (US-RPT-14). */
  taxableAmount: string;
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
  /** Credit notes, voids of earlier invoices and removed documents in the period; null when there are none (US-RPT-14). */
  adjustments: { taxableAmount: string; amount: string } | null;
  /** Taxable amount across the rows and adjustments. */
  totalTaxable: string;
}

export interface ReportAccountLine {
  accountId: string | undefined;
  code: string;
  name: string;
  amount: string;
}

export interface ProfitAndLossReport {
  from: string;
  to: string;
  income: ReportAccountLine[];
  expenses: ReportAccountLine[];
  totalIncome: string;
  totalExpenses: string;
  netProfit: string;
}

/** US-RPT-13 — one account's balance as of a date, on its debit or credit side. */
export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  debit: string;
  credit: string;
}

export interface TrialBalanceReport {
  asOf: string;
  lines: TrialBalanceLine[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

export interface BalanceSheetReport {
  asOf: string;
  assets: ReportAccountLine[];
  liabilities: ReportAccountLine[];
  /** Includes a computed "Retained Earnings (current period)" line — see balanceSheet's own doc comment. */
  equity: ReportAccountLine[];
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  totalLiabilitiesAndEquity: string;
}

export interface AccountDrilldownEntry {
  journalEntryId: string;
  date: string;
  narration: string | null;
  /** e.g. "invoice", "vendor_bill", "expense", "payment", "credit_note" — see each service's own postEntry call for the full set. */
  sourceType: string;
  sourceId: string;
  debit: string;
  credit: string;
}

export interface AccountDrilldownReport {
  accountId: string;
  accountCode: string;
  accountName: string;
  from: string;
  to: string;
  entries: AccountDrilldownEntry[];
}

export interface JobProfitabilityRow {
  jobId: string;
  name: string;
  status: string;
  currency: string;
  contractValueAmount: string;
  revenue: string;
  cost: string;
  margin: string;
  marginPct: number | null;
}

export interface JobProfitabilityReport {
  jobs: JobProfitabilityRow[];
}

export interface DashboardSummaryReport {
  cashPosition: string;
  totalReceivables: string;
  overdueInvoiceCount: number;
  monthRevenue: string;
}

export interface RevenueTrendReport {
  /** "YYYY-MM" keys, oldest first, always exactly `months` entries even when a month has zero revenue. */
  months: { month: string; revenue: string }[];
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
