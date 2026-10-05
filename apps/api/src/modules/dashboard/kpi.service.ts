import { Inject, Injectable } from "@nestjs/common";
import type { Kpi } from "@spine/shared";
import { and, eq, inArray, lte } from "drizzle-orm";
import { getEffectiveCapabilities, getMemberRole } from "../../auth/capability.util";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { accounts, creditNotes, invoices, journalEntries, journalLines, paymentAllocations, payments } from "../../db/schema";
import { orgClock } from "../../common/org-clock";

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The same day a month earlier (the month's last day when it has fewer days). */
export function monthEarlier(date: string): string {
  const y = +date.slice(0, 4);
  const m = +date.slice(5, 7) - 1;
  const d = +date.slice(8, 10);
  const target = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

function isoDate(value: Date | string | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

interface Line {
  date: string;
  code: string;
  type: string;
  debit: bigint;
  credit: bigint;
}

/**
 * US-DASH-14 (D-089) — the dashboard's key figures, each with a line of
 * the last 8 weeks and last month's figure: cash position (1000 + 1010),
 * profit this month (income less expenses, month to date), receivables
 * (1100) and overdue (invoices past due, with what was paid or credited by
 * then). Ledger figures come from journal lines (D-011). Needs
 * `reports.view_dashboard_summary`; others get the figures they may see
 * (US-DASH-17).
 */
@Injectable()
export class KpiService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(orgId: string, userId: string): Promise<Kpi[]> {
    const role = await getMemberRole(this.db, orgId, userId);
    if (role !== "owner" && role !== "staff") return [];
    const can = await getEffectiveCapabilities(this.db, { orgId, userId });
    if (!can["reports.view_dashboard_summary"]) return [];

    const today = orgClock().date;
    const monthAgo = monthEarlier(today);
    const weekEnds = Array.from({ length: 8 }, (_, i) => addDays(today, -7 * (7 - i)));
    const lines = await this.ledgerLines(orgId, today);
    const overdueAt = await this.overdueCalculator(orgId);

    const balance = (codes: string[], date: string) => lines.filter((l) => codes.includes(l.code) && l.date <= date).reduce((sum, l) => sum + l.debit - l.credit, 0n);
    const hasLines = (codes: string[], date: string) => lines.some((l) => codes.includes(l.code) && l.date <= date);
    const profit = (from: string, to: string) =>
      lines
        .filter((l) => l.date >= from && l.date <= to && (l.type === "income" || l.type === "expense"))
        .reduce((sum, l) => sum + l.credit - l.debit, 0n); // income credits less expense debits
    const hasProfitLines = (from: string, to: string) => lines.some((l) => l.date >= from && l.date <= to && (l.type === "income" || l.type === "expense"));

    const CASH = ["1000", "1010"];
    const AR = ["1100"];
    const monthStart = `${today.slice(0, 8)}01`;
    const lastMonthStart = `${monthAgo.slice(0, 8)}01`;
    const overdueNow = overdueAt(today);
    const overdueThen = overdueAt(monthAgo);
    const receivables = balance(AR, today);

    return [
      {
        key: "cash",
        label: "Cash position",
        format: "money",
        value: balance(CASH, today).toString(),
        previous: hasLines(CASH, monthAgo) ? balance(CASH, monthAgo).toString() : null,
        series: weekEnds.map((d) => balance(CASH, d).toString()),
      },
      {
        key: "profit",
        label: "Profit this month",
        format: "money",
        value: profit(monthStart, today).toString(),
        previous: hasProfitLines(lastMonthStart, monthAgo) ? profit(lastMonthStart, monthAgo).toString() : null,
        series: weekEnds.map((d) => profit(addDays(d, -6), d).toString()),
      },
      {
        key: "receivables",
        label: "Receivables",
        format: "money",
        value: receivables.toString(),
        previous: hasLines(AR, monthAgo) ? balance(AR, monthAgo).toString() : null,
        series: weekEnds.map((d) => balance(AR, d).toString()),
        detail: { current: (overdueNow.open - overdueNow.amount).toString(), overdue: overdueNow.amount.toString() },
      },
      {
        key: "overdue",
        label: "Overdue",
        format: "money",
        value: overdueNow.amount.toString(),
        previous: overdueThen.issuedBefore ? overdueThen.amount.toString() : null,
        series: weekEnds.map((d) => overdueAt(d).amount.toString()),
        detail: { count: overdueNow.count },
      },
    ];
  }

  private async ledgerLines(orgId: string, upTo: string): Promise<Line[]> {
    const rows = await this.db
      .select({ date: journalEntries.date, code: accounts.code, type: accounts.type, debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(journalEntries.orgId, orgId), lte(journalEntries.date, upTo)));
    return rows.map((r) => ({ date: isoDate(r.date)!, code: r.code, type: r.type, debit: r.debit, credit: r.credit }));
  }

  /**
   * Overdue as it stood on a date: issued invoices due before it, less
   * what had been paid (by payment date) and credited (by credit note date)
   * by then. Also the open total (overdue or not) and whether any invoice
   * had been issued by then.
   */
  private async overdueCalculator(orgId: string): Promise<(date: string) => { amount: bigint; count: number; open: bigint; issuedBefore: boolean }> {
    const issued = await this.db
      .select({ id: invoices.id, total: invoices.totalAmount, retention: invoices.retentionAmount, dueDate: invoices.dueDate, issuedAt: invoices.issuedAt })
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued")));
    const ids = issued.map((i) => i.id);
    const paid = ids.length
      ? await this.db
          .select({ invoiceId: paymentAllocations.invoiceId, amount: paymentAllocations.amount, date: payments.date })
          .from(paymentAllocations)
          .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
          .where(inArray(paymentAllocations.invoiceId, ids))
      : [];
    const credited = ids.length
      ? await this.db
          .select({ invoiceId: creditNotes.invoiceId, amount: creditNotes.totalAmount, date: creditNotes.date })
          .from(creditNotes)
          .where(and(inArray(creditNotes.invoiceId, ids), eq(creditNotes.status, "issued")))
      : [];

    return (date: string) => {
      let amount = 0n;
      let open = 0n;
      let count = 0;
      let issuedBefore = false;
      for (const inv of issued) {
        const issuedOn = isoDate(inv.issuedAt);
        if (!issuedOn || issuedOn > date) continue;
        issuedBefore = true;
        const settled =
          paid.filter((p) => p.invoiceId === inv.id && (isoDate(p.date) ?? "") <= date).reduce((s, p) => s + p.amount, 0n) +
          credited.filter((c) => c.invoiceId === inv.id && (isoDate(c.date) ?? "") <= date).reduce((s, c) => s + c.amount, 0n);
        const owed = inv.total - inv.retention - settled;
        if (owed <= 0n) continue;
        open += owed;
        const due = isoDate(inv.dueDate);
        if (due && due < date) {
          amount += owed;
          count += 1;
        }
      }
      return { amount, count, open, issuedBefore };
    };
  }
}
