import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, lte, notInArray, notLike, sql } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, invoices, journalEntries, journalLines, openingBalances, paymentAllocations, payments, vendorBills, vendorPaymentAllocations, vendorPayments } from "../../db/schema";
import type { ProfitAndLossReport, ReportAccountLine } from "./reports.service";

/** Entries whose income and expense lines are replaced by what was paid on the document (D-138). */
const ACCRUAL_SOURCES = ["invoice", "invoice_void", "credit_note", "credit_note_credit_applied", "vendor_bill", "vendor_bill_void", "vendor_credit", "vendor_credit_void"];

/** `value × part ÷ whole`, rounded half away from zero (whole > 0). */
export function prorate(value: bigint, part: bigint, whole: bigint): bigint {
  const n = value * part;
  const half = whole / 2n;
  return n >= 0n ? (n + half) / whole : -((-n + half) / whole);
}

export interface CashBasisProfitAndLoss extends ProfitAndLossReport {
  basis: "cash";
  /** Payments in the range on documents from before the cutover date, which aren't counted. */
  openingExcluded: { cutoverDate: string; invoices: string; bills: string } | null;
}

/**
 * US-RPT-35 (D-138) — Profit & Loss on a cash basis, derived at report
 * time; no postings. Invoice income counts in proportion to what was paid
 * on the invoice in the range (by payment date), split across the
 * invoice's income lines; bills likewise by vendor payment. Expenses,
 * journals and money in or out count as posted. Payments on opening
 * invoices and bills aren't income or cost: that was in the old books.
 */
@Injectable()
export class CashBasisService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async profitAndLoss(orgId: string, from: string, to: string): Promise<CashBasisProfitAndLoss> {
    const amounts = new Map<string, bigint>();
    const add = (accountId: string, v: bigint) => amounts.set(accountId, (amounts.get(accountId) ?? 0n) + v);

    // Customers: payment allocations by payment date.
    const received = await this.db
      .select({ invoiceId: invoices.id, total: invoices.totalAmount, type: invoices.type, amount: paymentAllocations.amount })
      .from(paymentAllocations)
      .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
      .innerJoin(invoices, eq(invoices.id, paymentAllocations.invoiceId))
      .where(and(eq(payments.orgId, orgId), sql`${payments.date} >= ${from}::date`, sql`${payments.date} <= ${to}::date`));
    const openingInvoices = received.filter((r) => r.type === "opening").reduce((s, r) => s + r.amount, 0n);
    const paidInvoices = received.filter((r) => r.type !== "opening" && r.total > 0n);
    const incomeLines = await this.documentLines(orgId, "invoice", paidInvoices.map((r) => r.invoiceId), "income");
    for (const r of paidInvoices) for (const l of incomeLines.get(r.invoiceId) ?? []) add(l.accountId, prorate(l.amount, r.amount, r.total));

    // Vendors: vendor payment allocations by payment date.
    const paid = await this.db
      .select({ billId: vendorBills.id, total: vendorBills.totalAmount, opening: vendorBills.isOpening, amount: vendorPaymentAllocations.amount })
      .from(vendorPaymentAllocations)
      .innerJoin(vendorPayments, eq(vendorPayments.id, vendorPaymentAllocations.vendorPaymentId))
      .innerJoin(vendorBills, eq(vendorBills.id, vendorPaymentAllocations.billId))
      .where(and(eq(vendorPayments.orgId, orgId), sql`${vendorPayments.date} >= ${from}::date`, sql`${vendorPayments.date} <= ${to}::date`));
    const openingBills = paid.filter((r) => r.opening).reduce((s, r) => s + r.amount, 0n);
    const paidBills = paid.filter((r) => !r.opening && r.total > 0n);
    const expenseLines = await this.documentLines(orgId, "vendor_bill", paidBills.map((r) => r.billId), "expense");
    for (const r of paidBills) for (const l of expenseLines.get(r.billId) ?? []) add(l.accountId, prorate(l.amount, r.amount, r.total));

    // Everything else that touches income or expense counts as posted: expenses, journals, money in and out.
    const posted = await this.db
      .select({ accountId: journalLines.accountId, type: accounts.type, debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          gte(journalEntries.date, from),
          lte(journalEntries.date, to),
          inArray(accounts.type, ["income", "expense"]),
          notInArray(journalEntries.sourceType, ACCRUAL_SOURCES),
          notLike(journalEntries.sourceType, "opening\\_%"),
        ),
      );
    for (const l of posted) add(l.accountId, l.type === "income" ? l.credit - l.debit : l.debit - l.credit);

    const chart = amounts.size
      ? await this.db.select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type }).from(accounts).where(and(eq(accounts.orgId, orgId), inArray(accounts.id, [...amounts.keys()])))
      : [];
    const income: ReportAccountLine[] = [];
    const expenses: ReportAccountLine[] = [];
    for (const a of chart.sort((x, y) => x.code.localeCompare(y.code))) {
      const amount = amounts.get(a.id) ?? 0n;
      if (amount === 0n) continue;
      (a.type === "income" ? income : expenses).push({ accountId: a.id, code: a.code, name: a.name, amount: amount.toString() });
    }
    const totalIncome = income.reduce((s, l) => s + BigInt(l.amount), 0n);
    const totalExpenses = expenses.reduce((s, l) => s + BigInt(l.amount), 0n);

    let openingExcluded: CashBasisProfitAndLoss["openingExcluded"] = null;
    if (openingInvoices > 0n || openingBills > 0n) {
      const [ob] = await this.db.select({ cutoverDate: openingBalances.cutoverDate }).from(openingBalances).where(eq(openingBalances.orgId, orgId));
      openingExcluded = { cutoverDate: ob?.cutoverDate ?? from, invoices: openingInvoices.toString(), bills: openingBills.toString() };
    }
    return {
      from,
      to,
      income,
      expenses,
      totalIncome: totalIncome.toString(),
      totalExpenses: totalExpenses.toString(),
      netProfit: (totalIncome - totalExpenses).toString(),
      basis: "cash",
      openingExcluded,
    };
  }

  /** Each document's posted income (credit-positive) or expense (debit-positive) lines from its issue/record entry, by account. */
  private async documentLines(orgId: string, sourceType: "invoice" | "vendor_bill", ids: string[], type: "income" | "expense") {
    const byDocument = new Map<string, { accountId: string; amount: bigint }[]>();
    if (!ids.length) return byDocument;
    const rows = await this.db
      .select({ sourceId: journalEntries.sourceId, accountId: journalLines.accountId, net: sql<string>`sum(${type === "income" ? sql`${journalLines.credit} - ${journalLines.debit}` : sql`${journalLines.debit} - ${journalLines.credit}`})` })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.sourceType, sourceType), inArray(journalEntries.sourceId, [...new Set(ids)]), eq(accounts.type, type)))
      .groupBy(journalEntries.sourceId, journalLines.accountId);
    for (const r of rows) {
      const list = byDocument.get(r.sourceId) ?? [];
      list.push({ accountId: r.accountId, amount: BigInt(r.net) });
      byDocument.set(r.sourceId, list);
    }
    return byDocument;
  }
}
