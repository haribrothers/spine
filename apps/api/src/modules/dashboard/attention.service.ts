import { Inject, Injectable } from "@nestjs/common";
import { budgetFigures, type AttentionItem, type AttentionKind, type AttentionRecord } from "@spine/shared";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { getEffectiveCapabilities, getMemberRole } from "../../auth/capability.util";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { activities, contacts, expenseCategories, expenses, invoices, jobAssignments, jobs, leads, milestones, quotes, settings, user, vendorBills } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { costByJob } from "../jobs/job-costing.service";

/** Kinds whose rows also carry the total of every record (US-NTF-13's digest shows it). */
const MONEY_KINDS = new Set<AttentionKind>(["invoices_overdue", "expenses_awaiting_approval", "vendor_bills_due"]);

/** How many records each row carries (the first is the one it names). */
const SAMPLE = 3;

function isoDate(value: Date | string | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * US-DASH-12 (D-087, D-088) — what's waiting on a member, one row per kind,
 * in a fixed order: overdue invoices, expenses to approve, quotes needing
 * discount approval, completed milestones not invoiced, quotes expiring
 * within 7 days, vendor bills due within 3 days, jobs over budget. A kind
 * the member has no capability for is left out, never shown locked. Rows
 * are worked out on every request, so a resolved item simply disappears.
 *
 * US-DASH-17 — Staff also get their own overdue follow-ups, and expiring
 * quotes are only their own ("Your quote …").
 *
 * US-DASH-18 — Field get only milestones due within 7 days on their
 * assigned jobs and their own rejected expenses; nothing with money
 * belonging to anyone else.
 */
@Injectable()
export class AttentionService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(orgId: string, userId: string): Promise<AttentionItem[]> {
    const role = await getMemberRole(this.db, orgId, userId);
    if (role !== "owner" && role !== "staff" && role !== "field") return [];
    const currency = await this.currency(orgId);
    const today = orgClock().date;
    if (role === "field") {
      const fieldRows = [await this.milestonesDue(orgId, userId, today, currency), await this.expensesRejected(orgId, userId, currency)];
      return fieldRows.filter((r) => r.count > 0);
    }
    const can = await getEffectiveCapabilities(this.db, { orgId, userId });

    const rows: (AttentionItem | null)[] = [
      await this.invoicesOverdue(orgId, today, currency),
      can["expenses.approve"] ? await this.expensesAwaitingApproval(orgId, role === "owner" ? null : userId, currency) : null,
      can["quotes.approve_discount"] ? await this.quotesDiscountApproval(orgId, currency) : null,
      can["milestones.invoice"] ? await this.milestonesToInvoice(orgId, currency) : null,
      await this.quotesExpiring(orgId, today, role === "owner" ? null : userId, currency),
      can["vendor_payments.edit_own"] ? await this.vendorBillsDue(orgId, today, currency) : null,
      can["reports.view_job_profitability"] ? await this.jobsOverBudget(orgId, currency) : null,
      role === "staff" ? await this.followupsOverdue(orgId, userId, currency) : null,
    ];
    return rows.filter((r): r is AttentionItem => r !== null && r.count > 0);
  }

  private item(kind: AttentionKind, count: number, currency: string, items: AttentionRecord[]): AttentionItem {
    const total = MONEY_KINDS.has(kind) ? items.reduce((sum, r) => sum + BigInt(r.amount ?? "0"), 0n).toString() : undefined;
    return { kind, count, currency, items: items.slice(0, SAMPLE), ...(total !== undefined ? { total } : {}) };
  }

  private async invoicesOverdue(orgId: string, today: string, currency: string): Promise<AttentionItem> {
    const balance = sql<bigint>`${invoices.totalAmount} - ${invoices.retentionAmount} - ${invoices.amountPaid} - ${invoices.creditedAmount}`;
    const rows = await this.db
      .select({ id: invoices.id, number: invoices.number, name: contacts.name, balance: sql<string>`(${balance})::text`, dueDate: invoices.dueDate })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued"), isNotNull(invoices.dueDate), lt(invoices.dueDate, new Date(`${today}T00:00:00Z`)), sql`${balance} > 0`))
      .orderBy(asc(invoices.dueDate));
    return this.item(
      "invoices_overdue",
      rows.length,
      currency,
      rows.map((r) => ({ id: r.id, number: r.number, name: r.name, amount: r.balance, date: isoDate(r.dueDate) })),
    );
  }

  /** Staff never see their own expenses here (D-085); Owners may approve their own. */
  private async expensesAwaitingApproval(orgId: string, excludeSubmitter: string | null, currency: string): Promise<AttentionItem> {
    const rows = await this.db
      .select({ id: expenses.id, submitter: user.name, category: expenseCategories.name, amount: expenses.amount, date: expenses.date })
      .from(expenses)
      .leftJoin(user, eq(expenses.submittedByUserId, user.id))
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(eq(expenses.orgId, orgId), eq(expenses.status, "submitted"), excludeSubmitter ? sql`${expenses.submittedByUserId} is distinct from ${excludeSubmitter}` : undefined))
      .orderBy(asc(expenses.date), asc(expenses.createdAt));
    return this.item(
      "expenses_awaiting_approval",
      rows.length,
      currency,
      rows.map((r) => ({ id: r.id, name: r.submitter, party: r.category, amount: r.amount.toString(), date: isoDate(r.date) })),
    );
  }

  private async quotesDiscountApproval(orgId: string, currency: string): Promise<AttentionItem> {
    const rows = await this.db
      .select({ id: quotes.id, number: quotes.number, name: contacts.name, subtotal: quotes.subtotalAmount, discount: quotes.discountAmount, total: quotes.totalAmount })
      .from(quotes)
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(and(eq(quotes.orgId, orgId), eq(quotes.status, "draft"), eq(quotes.discountRequiresApproval, true), isNull(quotes.approvedAt)))
      .orderBy(asc(quotes.createdAt));
    return this.item(
      "quotes_discount_approval",
      rows.length,
      currency,
      rows.map((r) => ({
        id: r.id,
        number: r.number,
        name: r.name,
        amount: r.total.toString(),
        note: r.subtotal > 0n ? `${Math.round(Number((r.discount * 1000n) / r.subtotal) / 10)}% discount` : null,
      })),
    );
  }

  private async milestonesToInvoice(orgId: string, currency: string): Promise<AttentionItem> {
    const rows = await this.db
      .select({ id: milestones.id, name: milestones.name, jobId: jobs.id, jobName: jobs.name, completedBy: user.name, completedAt: milestones.completedAt })
      .from(milestones)
      .innerJoin(jobs, eq(milestones.jobId, jobs.id))
      .leftJoin(user, eq(milestones.completedByUserId, user.id))
      .where(and(eq(milestones.orgId, orgId), eq(milestones.status, "completed")))
      .orderBy(asc(milestones.completedAt));
    return this.item(
      "milestones_to_invoice",
      rows.length,
      currency,
      rows.map((r) => ({ id: r.id, name: r.name, party: r.jobName, note: r.completedBy, jobId: r.jobId, date: isoDate(r.completedAt) })),
    );
  }

  /** Sent quotes whose validity ends within 7 days; Staff see their own (US-DASH-17). */
  private async quotesExpiring(orgId: string, today: string, onlyCreatedBy: string | null, currency: string): Promise<AttentionItem> {
    const rows = await this.db
      .select({ id: quotes.id, number: quotes.number, name: contacts.name, total: quotes.totalAmount, validUntil: quotes.validUntil })
      .from(quotes)
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(
        and(
          eq(quotes.orgId, orgId),
          eq(quotes.status, "sent"),
          gte(quotes.validUntil, new Date(`${today}T00:00:00Z`)),
          lte(quotes.validUntil, new Date(`${addDays(today, 7)}T00:00:00Z`)),
          onlyCreatedBy ? eq(quotes.createdByUserId, onlyCreatedBy) : undefined,
        ),
      )
      .orderBy(asc(quotes.validUntil));
    return {
      ...this.item(
        "quotes_expiring",
        rows.length,
        currency,
        rows.map((r) => ({ id: r.id, number: r.number, name: r.name, amount: r.total.toString(), date: isoDate(r.validUntil) })),
      ),
      ...(onlyCreatedBy ? { mine: true } : {}),
    };
  }

  /** US-DASH-17 — the member's open follow-ups past their due time, oldest first. */
  private async followupsOverdue(orgId: string, userId: string, currency: string): Promise<AttentionItem> {
    const rows = await this.db
      .select({ id: activities.id, type: activities.type, notes: activities.notes, dueAt: activities.dueAt, contactId: sql<string | null>`coalesce(${activities.contactId}, ${leads.contactId})` })
      .from(activities)
      .leftJoin(leads, eq(activities.leadId, leads.id))
      .where(and(eq(activities.orgId, orgId), eq(activities.assignedToUserId, userId), isNull(activities.doneAt), lt(activities.dueAt, new Date())))
      .orderBy(asc(activities.dueAt));
    const names = await this.contactNames(rows.map((r) => r.contactId).filter((id): id is string => Boolean(id)));
    const TYPE: Record<string, string> = { call: "Call", meeting: "Meeting", note: "Note", task: "Task" };
    return this.item(
      "followups_overdue",
      rows.length,
      currency,
      rows.map((r) => ({ id: r.id, name: r.notes?.trim() || TYPE[r.type] || "Follow-up", party: r.contactId ? (names.get(r.contactId) ?? null) : null, contactId: r.contactId, date: isoDate(r.dueAt) })),
    );
  }

  /** US-DASH-18 — pending milestones due within 7 days (or already late) on jobs the member is assigned to. */
  private async milestonesDue(orgId: string, userId: string, today: string, currency: string): Promise<AttentionItem> {
    const rows = await this.db
      .select({ id: milestones.id, name: milestones.name, jobId: jobs.id, jobName: jobs.name, dueDate: milestones.dueDate })
      .from(milestones)
      .innerJoin(jobs, eq(milestones.jobId, jobs.id))
      .innerJoin(jobAssignments, and(eq(jobAssignments.jobId, jobs.id), eq(jobAssignments.userId, userId)))
      .where(and(eq(milestones.orgId, orgId), eq(milestones.status, "pending"), isNotNull(milestones.dueDate), lte(milestones.dueDate, new Date(`${addDays(today, 7)}T00:00:00Z`))))
      .orderBy(asc(milestones.dueDate), asc(milestones.sequence));
    return this.item(
      "milestones_due",
      rows.length,
      currency,
      rows.map((r) => ({ id: r.id, name: r.name, party: r.jobName, jobId: r.jobId, date: isoDate(r.dueDate) })),
    );
  }

  /** US-DASH-18 — the member's own expenses sent back, with the reviewer's reason and name. */
  private async expensesRejected(orgId: string, userId: string, currency: string): Promise<AttentionItem> {
    const rows = await this.db
      .select({ id: expenses.id, category: expenseCategories.name, amount: expenses.amount, comment: expenses.reviewComment, reviewer: user.name, rejectedAt: expenses.rejectedAt })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(user, eq(expenses.rejectedByUserId, user.id))
      .where(and(eq(expenses.orgId, orgId), eq(expenses.status, "rejected"), eq(expenses.submittedByUserId, userId)))
      .orderBy(sql`${expenses.rejectedAt} desc nulls last`);
    return this.item(
      "expenses_rejected",
      rows.length,
      currency,
      rows.map((r) => ({ id: r.id, party: r.category, amount: r.amount.toString(), note: r.comment, name: r.reviewer, date: isoDate(r.rejectedAt) })),
    );
  }

  private async contactNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db.select({ id: contacts.id, name: contacts.name }).from(contacts).where(inArray(contacts.id, ids));
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** Recorded bills with a balance, due today or within 3 days. */
  private async vendorBillsDue(orgId: string, today: string, currency: string): Promise<AttentionItem> {
    const rows = await this.db
      .select({ id: vendorBills.id, contactId: vendorBills.contactId, number: vendorBills.billNumber, name: contacts.name, balance: sql<string>`(${vendorBills.totalAmount} - ${vendorBills.amountPaid} - ${vendorBills.creditedAmount})::text`, dueDate: vendorBills.dueDate })
      .from(vendorBills)
      .leftJoin(contacts, eq(vendorBills.contactId, contacts.id))
      .where(
        and(
          eq(vendorBills.orgId, orgId),
          eq(vendorBills.status, "recorded"),
          sql`${vendorBills.totalAmount} - ${vendorBills.amountPaid} - ${vendorBills.creditedAmount} > 0`,
          gte(vendorBills.dueDate, new Date(`${today}T00:00:00Z`)),
          lte(vendorBills.dueDate, new Date(`${addDays(today, 3)}T00:00:00Z`)),
        ),
      )
      .orderBy(asc(vendorBills.dueDate));
    return this.item(
      "vendor_bills_due",
      rows.length,
      currency,
      rows.map((r) => ({ id: r.id, contactId: r.contactId, number: r.number, name: r.name, amount: r.balance, date: isoDate(r.dueDate) })),
    );
  }

  /** US-JOB-25 — active jobs whose cost has passed their budget, the furthest over first. */
  private async jobsOverBudget(orgId: string, currency: string): Promise<AttentionItem> {
    const active = await this.db
      .select({ id: jobs.id, number: jobs.number, name: jobs.name, budget: jobs.costBudgetAmount })
      .from(jobs)
      .where(and(eq(jobs.orgId, orgId), inArray(jobs.status, ["active", "on_hold"]), isNotNull(jobs.costBudgetAmount)));
    const costs = await costByJob(this.db, active.map((j) => j.id));
    const over = active
      .map((j) => ({ ...j, cost: costs.get(j.id) ?? 0n }))
      .filter((j) => budgetFigures(j.budget, j.cost).state === "over")
      .sort((a, b) => (b.cost - b.budget! > a.cost - a.budget! ? 1 : -1));
    return this.item(
      "jobs_over_budget",
      over.length,
      currency,
      over.map((j) => ({ id: j.id, number: j.number, name: j.name, amount: j.cost.toString(), budget: j.budget!.toString(), jobId: j.id })),
    );
  }

  private async currency(orgId: string): Promise<string> {
    const [row] = await this.db.select({ value: settings.value }).from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, "currency")));
    return (row?.value as { code?: string } | undefined)?.code ?? "USD";
  }
}

