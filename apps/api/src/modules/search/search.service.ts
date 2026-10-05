import { Inject, Injectable } from "@nestjs/common";
import {
  SEARCH_GROUP_LABELS,
  SEARCH_MIN_LENGTH,
  formatMoney,
  isNumberMatch,
  parseDocumentNumber,
  type SearchGroup,
  type SearchGroupType,
  type SearchResponse,
  type SearchResult,
} from "@spine/shared";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getMemberRole } from "../../auth/capability.util";
import { orgClock } from "../../common/org-clock";
import { orgLocale } from "../../common/money-format";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
import { contacts, expenseCategories, expenses, invoices, jobAssignments, jobs, quotes, user, vendorBills } from "../../db/schema";

const MAX_PER_GROUP = 5;

const QUOTE_STATUS: Record<string, string> = { draft: "Draft", sent: "Sent", accepted: "Accepted", rejected: "Declined" };
const JOB_STATUS: Record<string, string> = { active: "Active", on_hold: "On hold", completed: "Completed", cancelled: "Cancelled" };
const EXPENSE_STATUS: Record<string, string> = { submitted: "Submitted", approved: "Approved", rejected: "Rejected" };

function isoDate(value: Date | string | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

/** `%q%` with LIKE's own wildcards taken literally. */
function contains(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * US-OPS-22 (D-095) — one search across contacts, quotes, jobs, invoices,
 * vendor bills and expenses, using trigram indexes. Each group applies its
 * module's own read rules: Owners and Staff read every record here; Field
 * read only jobs they're assigned to and their own expenses (and never a
 * contact, quote, invoice or bill page). A document number puts that
 * document first.
 */
@Injectable()
export class SearchService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async search(orgId: string, userId: string, rawQuery: string, limit = MAX_PER_GROUP): Promise<SearchResponse> {
    const q = rawQuery.trim().slice(0, 100);
    if (q.length < SEARCH_MIN_LENGTH) return { query: q, groups: [] };
    const role = await getMemberRole(this.db, orgId, userId);
    if (!role) return { query: q, groups: [] };
    const field = role === "field";
    const n = Math.min(Math.max(limit, 1), MAX_PER_GROUP);
    const locale = await orgLocale(this.db, orgId);
    const money = (amount: bigint, currency: string) => formatMoney(amount, currency, locale);
    const ctx = { orgId, userId, q, n, money, today: orgClock().date };

    const results: Record<SearchGroupType, (SearchResult & { exact: boolean })[]> = {
      contacts: field ? [] : await this.contacts(ctx),
      quotes: field ? [] : await this.quotes(ctx),
      jobs: await this.jobs(ctx, field),
      invoices: field ? [] : await this.invoices(ctx),
      vendor_bills: field ? [] : await this.vendorBills(ctx),
      expenses: await this.expenses(ctx, field),
    };

    const groups: (SearchGroup & { exact: boolean })[] = (Object.keys(results) as SearchGroupType[])
      .filter((type) => results[type].length > 0)
      .map((type) => ({
        type,
        label: SEARCH_GROUP_LABELS[type],
        exact: results[type].some((r) => r.exact),
        items: results[type].map(({ exact: _exact, ...item }) => item),
      }));
    // The group holding the document the number names comes first (stable for the rest).
    groups.sort((a, b) => Number(b.exact) - Number(a.exact));
    return { query: q, groups: groups.map(({ exact: _exact, ...g }) => g) };
  }

  /** Matches on the text, plus a typed number like "QUO-4" against "QUO-0004". */
  private numberOrText(numberCol: PgColumn, q: string, ...textCols: PgColumn[]): SQL {
    const parsed = parseDocumentNumber(q);
    return or(
      ilike(numberCol, contains(q)),
      ...textCols.map((c) => ilike(c, contains(q))),
      parsed ? sql`${numberCol} ~* ${`^${parsed.prefix}[^0-9]*0*${parsed.value}$`}` : undefined,
    )!;
  }

  private rank(numberCol: PgColumn | null, nameCol: PgColumn, q: string): SQL[] {
    const parsed = parseDocumentNumber(q);
    const similarity = desc(sql`greatest(similarity(coalesce(${nameCol}, ''), ${q}), ${numberCol ? sql`similarity(coalesce(${numberCol}, ''), ${q})` : sql`0`})`);
    if (!numberCol) return [similarity];
    const exact = parsed
      ? sql`(coalesce(${numberCol} ~* ${`^${parsed.prefix}[^0-9]*0*${parsed.value}$`}, false) or lower(coalesce(${numberCol}, '')) = lower(${q}))`
      : sql`lower(coalesce(${numberCol}, '')) = lower(${q})`;
    return [desc(exact), similarity];
  }

  private async contacts(c: Ctx) {
    const rows = await this.db
      .select({ id: contacts.id, name: contacts.name, type: contacts.type, email: contacts.email, phone: contacts.phone })
      .from(contacts)
      .where(and(eq(contacts.orgId, c.orgId), sql`${contacts.archivedAt} is null`, or(ilike(contacts.name, contains(c.q)), ilike(contacts.email, contains(c.q)))))
      .orderBy(...this.rank(null, contacts.name, c.q))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: r.name,
      subtitle: [r.type === "vendor" ? "Vendor" : r.type === "both" ? "Customer and vendor" : "Customer", r.email ?? r.phone].filter(Boolean).join(" · "),
      status: "Contact",
      href: `/contacts/${r.id}`,
      exact: false,
    }));
  }

  private async quotes(c: Ctx) {
    const rows = await this.db
      .select({ id: quotes.id, number: quotes.number, status: quotes.status, total: quotes.totalAmount, currency: quotes.currency, contact: contacts.name })
      .from(quotes)
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(and(eq(quotes.orgId, c.orgId), this.numberOrText(quotes.number, c.q, contacts.name)))
      .orderBy(...this.rank(quotes.number, contacts.name, c.q), desc(quotes.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: r.number ?? "Draft quote",
      subtitle: [r.contact, c.money(r.total, r.currency)].filter(Boolean).join(" · "),
      status: QUOTE_STATUS[r.status] ?? r.status,
      href: `/quotes/${r.id}`,
      exact: isNumberMatch(r.number, c.q),
    }));
  }

  private async jobs(c: Ctx, field: boolean) {
    const rows = await this.db
      .select({ id: jobs.id, number: jobs.number, name: jobs.name, status: jobs.status, site: jobs.siteAddress, contact: contacts.name })
      .from(jobs)
      .leftJoin(contacts, eq(jobs.contactId, contacts.id))
      .where(
        and(
          eq(jobs.orgId, c.orgId),
          this.numberOrText(jobs.number, c.q, jobs.name, contacts.name),
          // Field: only jobs they're on (US-JOB-19).
          field ? inArray(jobs.id, this.db.select({ id: jobAssignments.jobId }).from(jobAssignments).where(eq(jobAssignments.userId, c.userId))) : undefined,
        ),
      )
      .orderBy(...this.rank(jobs.number, jobs.name, c.q), desc(jobs.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: [r.number, r.name].filter(Boolean).join(" · "),
      subtitle: r.site ?? r.contact,
      status: JOB_STATUS[r.status] ?? r.status,
      href: `/jobs/${r.id}`,
      exact: isNumberMatch(r.number, c.q),
    }));
  }

  private async invoices(c: Ctx) {
    const balance = sql<string>`(${invoices.totalAmount} - ${invoices.retentionAmount} - ${invoices.amountPaid} - ${invoices.creditedAmount})::text`;
    const rows = await this.db
      .select({ id: invoices.id, number: invoices.number, status: invoices.status, currency: invoices.currency, total: invoices.totalAmount, balance, dueDate: invoices.dueDate, contact: contacts.name })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.orgId, c.orgId), this.numberOrText(invoices.number, c.q, contacts.name)))
      .orderBy(...this.rank(invoices.number, contacts.name, c.q), desc(invoices.createdAt))
      .limit(c.n);
    return rows.map((r) => {
      const due = BigInt(r.balance);
      const dueDate = isoDate(r.dueDate);
      const status =
        r.status === "void" ? "Void" : r.status === "draft" ? "Draft" : due <= 0n ? "Paid" : dueDate && dueDate < c.today ? "Overdue" : "Issued";
      const amount = r.status === "issued" && due > 0n ? `${c.money(due, r.currency)} due` : c.money(r.total, r.currency);
      return { id: r.id, title: r.number ?? "Draft invoice", subtitle: [r.contact, amount].filter(Boolean).join(" · "), status, href: `/invoices/${r.id}`, exact: isNumberMatch(r.number, c.q) };
    });
  }

  private async vendorBills(c: Ctx) {
    const rows = await this.db
      .select({ id: vendorBills.id, number: vendorBills.billNumber, status: vendorBills.status, currency: vendorBills.currency, total: vendorBills.totalAmount, paid: vendorBills.amountPaid, dueDate: vendorBills.dueDate, vendor: contacts.name })
      .from(vendorBills)
      .leftJoin(contacts, eq(vendorBills.contactId, contacts.id))
      .where(and(eq(vendorBills.orgId, c.orgId), this.numberOrText(vendorBills.billNumber, c.q, contacts.name)))
      .orderBy(...this.rank(vendorBills.billNumber, contacts.name, c.q), desc(vendorBills.createdAt))
      .limit(c.n);
    return rows.map((r) => {
      const open = r.total - r.paid;
      const dueDate = isoDate(r.dueDate);
      const status = r.status === "void" ? "Void" : r.status === "draft" ? "Draft" : open <= 0n ? "Paid" : dueDate && dueDate < c.today ? "Overdue" : "Unpaid";
      return { id: r.id, title: [r.number, r.vendor].filter(Boolean).join(" · "), subtitle: c.money(r.total, r.currency), status, href: `/vendor-bills/${r.id}`, exact: isNumberMatch(r.number, c.q) };
    });
  }

  private async expenses(c: Ctx, field: boolean) {
    const rows = await this.db
      .select({ id: expenses.id, number: expenses.number, status: expenses.status, amount: expenses.amount, currency: expenses.currency, date: expenses.date, category: expenseCategories.name, submitter: user.name })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(user, eq(expenses.submittedByUserId, user.id))
      .where(
        and(
          eq(expenses.orgId, c.orgId),
          this.numberOrText(expenses.number, c.q, expenseCategories.name, expenses.description),
          // Field: only their own expenses (US-OPS-20).
          field ? eq(expenses.submittedByUserId, c.userId) : undefined,
        ),
      )
      .orderBy(...this.rank(expenses.number, expenseCategories.name, c.q), desc(expenses.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: [r.number, r.category].filter(Boolean).join(" · ") || "Expense",
      subtitle: [r.submitter, c.money(r.amount, r.currency), isoDate(r.date)].filter(Boolean).join(" · "),
      status: EXPENSE_STATUS[r.status] ?? r.status,
      href: `/expenses?id=${r.id}`,
      exact: isNumberMatch(r.number, c.q),
    }));
  }
}

interface Ctx {
  orgId: string;
  userId: string;
  q: string;
  n: number;
  money: (amount: bigint, currency: string) => string;
  today: string;
}
