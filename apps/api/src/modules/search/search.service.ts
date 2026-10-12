import { moduleOn } from "../../common/modules";
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
import { getEffectiveCapabilities, getMemberRole } from "../../auth/capability.util";
import { orgClock } from "../../common/org-clock";
import { orgLocale } from "../../common/money-format";
import type { Database } from "../../db/client";
import { DATABASE } from "../../db/db.module";
import { contacts, creditNotes, expenseCategories, expenses, invoices, jobAssignments, jobs, payments, quotes, user, vendorBills, vendorPayments } from "../../db/schema";

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

    // US-TEAM-31 (D-235): a section closed for every one of a Staff member's Teams isn't searched.
    const can = await getEffectiveCapabilities(this.db, { orgId, userId });
    const open = (capability: keyof typeof can) => !field && can[capability];

    const results: Record<SearchGroupType, (SearchResult & { exact: boolean })[]> = {
      contacts: open("contacts.open") ? await this.contacts(ctx) : [],
      quotes: open("quotes.open") ? await this.quotes(ctx) : [],
      // US-SET-24: no Jobs group while Jobs & field is switched off.
      jobs: (field || can["jobs.open"]) && (await moduleOn(this.db, orgId, "jobsField")) ? await this.jobs(ctx, field) : [],
      invoices: open("invoices.open") ? await this.invoices(ctx) : [],
      // US-INV-38: credit notes are Owner and Staff only, like invoices.
      credit_notes: open("credit_notes.open") ? await this.creditNotes(ctx) : [],
      // US-PAY-25: payments are Owner and Staff only.
      payments: open("payments.open") ? await this.payments(ctx) : [],
      vendor_bills: open("vendor_bills.open") ? await this.vendorBills(ctx) : [],
      // US-PUR-55: vendor payments are Owner and Staff only.
      vendor_payments: open("vendor_payments.open") ? await this.vendorPayments(ctx) : [],
      // Field, and Staff without "See everyone's expenses", find only their own.
      expenses: await this.expenses(ctx, field || !can["expenses.view_others"]),
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

  /** US-INV-38 — by number, customer, the invoice's number or the reason; "₹7,856.00 credit left" while credit is left. */
  private async creditNotes(c: Ctx) {
    const rows = await this.db
      .select({ id: creditNotes.id, number: creditNotes.number, status: creditNotes.status, currency: creditNotes.currency, total: creditNotes.totalAmount, left: creditNotes.creditRemainingAmount, contact: contacts.name, invoice: invoices.number })
      .from(creditNotes)
      .leftJoin(contacts, eq(creditNotes.contactId, contacts.id))
      .leftJoin(invoices, eq(creditNotes.invoiceId, invoices.id))
      .where(and(eq(creditNotes.orgId, c.orgId), this.numberOrText(creditNotes.number, c.q, contacts.name, invoices.number, creditNotes.reason)))
      .orderBy(...this.rank(creditNotes.number, contacts.name, c.q), desc(creditNotes.createdAt))
      .limit(c.n);
    return rows.map((r) => ({
      id: r.id,
      title: r.number ?? "Draft credit note",
      subtitle: [r.contact, r.invoice ? `against ${r.invoice}` : null, c.money(r.total, r.currency)].filter(Boolean).join(" · "),
      status: r.status === "draft" ? "Draft" : r.left > 0n ? `${c.money(r.left, r.currency)} credit left` : "Credited",
      href: `/credit-notes/${r.id}`,
      exact: isNumberMatch(r.number, c.q),
    }));
  }

  /** US-PAY-25 — by receipt number, reference or customer: "Halcyon Tech Parks · ₹45,000.00 · 10 Oct", with the credit left. */
  private async payments(c: Ctx) {
    const rows = await this.db
      .select({ id: payments.id, number: payments.number, date: payments.date, currency: payments.currency, amount: payments.amount, allocated: payments.allocatedAmount, refunded: payments.refundedAmount, contact: contacts.name })
      .from(payments)
      .leftJoin(contacts, eq(payments.contactId, contacts.id))
      .where(and(eq(payments.orgId, c.orgId), this.numberOrText(payments.number, c.q, contacts.name, payments.reference)))
      .orderBy(...this.rank(payments.number, contacts.name, c.q), desc(payments.date), desc(payments.createdAt))
      .limit(c.n);
    return rows.map((r) => {
      const left = r.amount - r.allocated - r.refunded;
      const day = new Date(`${typeof r.date === "string" ? r.date : new Date(r.date).toISOString().slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
      return {
        id: r.id,
        title: r.number ?? "Payment",
        subtitle: [r.contact, c.money(r.amount, r.currency), day].filter(Boolean).join(" · "),
        status: left > 0n ? `${c.money(left, r.currency)} credit left` : null,
        href: `/payments/${r.id}`,
        exact: isNumberMatch(r.number, c.q),
      };
    });
  }

  /** US-PUR-55 — by number, reference or vendor: "VPY-0014 · Ridgeline · ₹48,000.00 · 11 Oct". */
  private async vendorPayments(c: Ctx) {
    const rows = await this.db
      .select({ id: vendorPayments.id, number: vendorPayments.number, date: vendorPayments.date, currency: vendorPayments.currency, amount: vendorPayments.amount, vendor: contacts.name })
      .from(vendorPayments)
      .leftJoin(contacts, eq(vendorPayments.contactId, contacts.id))
      .where(and(eq(vendorPayments.orgId, c.orgId), this.numberOrText(vendorPayments.number, c.q, contacts.name, vendorPayments.reference)))
      .orderBy(...this.rank(vendorPayments.number, contacts.name, c.q), desc(vendorPayments.date), desc(vendorPayments.createdAt))
      .limit(c.n);
    return rows.map((r) => {
      const day = new Date(`${typeof r.date === "string" ? r.date : new Date(r.date).toISOString().slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
      return {
        id: r.id,
        title: r.number ?? "Vendor payment",
        subtitle: [r.vendor, c.money(r.amount, r.currency), day].filter(Boolean).join(" · "),
        status: null,
        href: `/vendor-payments/${r.id}`,
        exact: isNumberMatch(r.number, c.q),
      };
    });
  }

  private async vendorBills(c: Ctx) {
    const rows = await this.db
      .select({ id: vendorBills.id, number: vendorBills.billNumber, status: vendorBills.status, currency: vendorBills.currency, total: vendorBills.totalAmount, paid: vendorBills.amountPaid, credited: vendorBills.creditedAmount, dueDate: vendorBills.dueDate, vendor: contacts.name })
      .from(vendorBills)
      .leftJoin(contacts, eq(vendorBills.contactId, contacts.id))
      .where(and(eq(vendorBills.orgId, c.orgId), this.numberOrText(vendorBills.billNumber, c.q, contacts.name)))
      .orderBy(...this.rank(vendorBills.billNumber, contacts.name, c.q), desc(vendorBills.createdAt))
      .limit(c.n);
    return rows.map((r) => {
      const open = r.total - r.paid - r.credited;
      const dueDate = isoDate(r.dueDate);
      const status = r.status === "void" ? "Void" : r.status === "draft" ? "Draft" : open <= 0n ? "Paid" : dueDate && dueDate < c.today ? "Overdue" : "Unpaid";
      return { id: r.id, title: [r.number, r.vendor].filter(Boolean).join(" · "), subtitle: c.money(r.total, r.currency), status, href: `/vendor-bills/${r.id}`, exact: isNumberMatch(r.number, c.q) };
    });
  }

  private async expenses(c: Ctx, ownOnly: boolean) {
    const rows = await this.db
      .select({ id: expenses.id, number: expenses.number, status: expenses.status, amount: expenses.amount, currency: expenses.currency, date: expenses.date, category: expenseCategories.name, submitter: user.name })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(user, eq(expenses.submittedByUserId, user.id))
      .where(
        and(
          eq(expenses.orgId, c.orgId),
          this.numberOrText(expenses.number, c.q, expenseCategories.name, expenses.description),
          // Field (US-OPS-20) and Staff without "See everyone's expenses" (US-TEAM-30): only their own.
          ownOnly ? eq(expenses.submittedByUserId, c.userId) : undefined,
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
