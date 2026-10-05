import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { formatMoney } from "@spine/shared";
import { orgLocale } from "../../common/money-format";
import {
  quoteEvents,
  quotes,
  payments,
  contacts,
  expenses,
  expenseCategories,
  jobAssignments,
  jobs,
  milestones,
} from "../../db/schema";

export interface ActivityFeedEntry {
  type: string;
  message: string;
  link: string | null;
  occurredAt: string;
}

const FEED_LIMIT = 30;
/** Per-source fetch cap before merging — generous enough that a busy org's most recent 30 overall entries are never missed just because one source alone had >30 rows in between. */
const PER_SOURCE_LIMIT = 30;

/**
 * S-09.14 (dashboard v2) — an org-wide "what just happened" feed, distinct
 * from `NotificationsService.listRecent` (strictly per-recipient,
 * fan-out-on-write — see this service's own module doc comment for why
 * that shape doesn't fit an org-wide feed). Reads each event's own
 * source-of-truth table directly, one small typed query per source, then
 * merges/sorts/limits in application code — simpler and more type-safe
 * than a hand-written cross-table SQL UNION, and each source's message
 * text stays readable TypeScript rather than embedded SQL string
 * concatenation.
 */
@Injectable()
export class ActivityFeedService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * `role === "field"` excludes both financial sources (payments,
   * expenses) entirely — never fetched, not post-filtered — matching the
   * PRD's "financial-events-excluded activity feed" requirement for
   * Field's dashboard layout.
   */
  async list(orgId: string, role: string | null, userId?: string): Promise<ActivityFeedEntry[]> {
    const includeFinancial = role !== "field";
    // US-DASH-18: Field see events on their assigned jobs only — no quotes, no money.
    const onlyJobs =
      role === "field" && userId
        ? (await this.db.select({ jobId: jobAssignments.jobId }).from(jobAssignments).where(eq(jobAssignments.userId, userId))).map((r) => r.jobId)
        : null;

    const [quoteEntries, paymentEntries, expenseEntries, jobEntries, milestoneEntries] = await Promise.all([
      includeFinancial ? this.quoteEventEntries(orgId) : Promise.resolve([]),
      includeFinancial ? this.paymentEntries(orgId) : Promise.resolve([]),
      includeFinancial ? this.expenseEntries(orgId) : Promise.resolve([]),
      onlyJobs?.length === 0 ? Promise.resolve([]) : this.jobEntries(orgId, onlyJobs),
      onlyJobs?.length === 0 ? Promise.resolve([]) : this.milestoneEntries(orgId, onlyJobs),
    ]);

    return [...quoteEntries, ...paymentEntries, ...expenseEntries, ...jobEntries, ...milestoneEntries]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, FEED_LIMIT);
  }

  private async quoteEventEntries(orgId: string): Promise<ActivityFeedEntry[]> {
    const rows = await this.db
      .select({ event: quoteEvents, quoteNumber: quotes.number, quoteId: quotes.id })
      .from(quoteEvents)
      .innerJoin(quotes, eq(quoteEvents.quoteId, quotes.id))
      .where(and(eq(quoteEvents.orgId, orgId)))
      .orderBy(desc(quoteEvents.createdAt))
      .limit(PER_SOURCE_LIMIT);

    return rows
      .filter((row) => row.event.type === "viewed" || row.event.type === "accepted")
      .map((row) => {
        const label = row.quoteNumber ?? "Draft quote";
        const message = row.event.type === "viewed" ? `Quote ${label} was viewed` : `Quote ${label} was accepted`;
        return {
          type: row.event.type === "viewed" ? "quote_viewed" : "quote_accepted",
          message,
          link: `/quotes/${row.quoteId}`,
          occurredAt: row.event.createdAt.toISOString(),
        };
      });
  }

  private async paymentEntries(orgId: string): Promise<ActivityFeedEntry[]> {
    const rows = await this.db
      .select({ payment: payments, contactName: contacts.name })
      .from(payments)
      .innerJoin(contacts, eq(payments.contactId, contacts.id))
      .where(eq(payments.orgId, orgId))
      .orderBy(desc(payments.createdAt))
      .limit(PER_SOURCE_LIMIT);

    const locale = await orgLocale(this.db, orgId);
    return rows.map((row) => ({
      type: "payment_received",
      message: `Payment of ${formatMoney(row.payment.amount, row.payment.currency, locale)} received from ${row.contactName}`,
      link: `/payments/${row.payment.id}`,
      occurredAt: row.payment.createdAt.toISOString(),
    }));
  }

  private async expenseEntries(orgId: string): Promise<ActivityFeedEntry[]> {
    const rows = await this.db
      .select({ expense: expenses, categoryName: expenseCategories.name })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(eq(expenses.orgId, orgId), eq(expenses.status, "approved")))
      .orderBy(desc(expenses.approvedAt))
      .limit(PER_SOURCE_LIMIT);

    const locale = await orgLocale(this.db, orgId);
    return rows
      .filter((row) => row.expense.approvedAt !== null)
      .map((row) => ({
        type: "expense_approved",
        message: `Expense approved — ${row.categoryName}, ${formatMoney(row.expense.amount, row.expense.currency, locale)}`,
        link: `/expenses?id=${row.expense.id}`,
        occurredAt: row.expense.approvedAt!.toISOString(),
      }));
  }

  private async jobEntries(orgId: string, onlyJobs: string[] | null): Promise<ActivityFeedEntry[]> {
    const rows = await this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.orgId, orgId), eq(jobs.status, "completed"), onlyJobs ? inArray(jobs.id, onlyJobs) : undefined))
      .orderBy(desc(jobs.updatedAt))
      .limit(PER_SOURCE_LIMIT);

    return rows.map((row) => ({
      type: "job_completed",
      message: `Job "${row.name}" marked completed`,
      link: `/jobs/${row.id}`,
      occurredAt: row.updatedAt.toISOString(),
    }));
  }

  /**
   * `completedAt IS NOT NULL` rather than `status = 'completed'` — a
   * milestone's own lifecycle continues past "completed" to "invoiced"
   * (see milestones.ts's own doc comment), but `completedAt` is set once,
   * at the moment S-04.4's completion actually happened, and never
   * cleared — so this is the real "did a completion event occur" signal,
   * not just "is it currently sitting in the completed state."
   */
  private async milestoneEntries(orgId: string, onlyJobs: string[] | null): Promise<ActivityFeedEntry[]> {
    const rows = await this.db
      .select({ milestone: milestones, jobName: jobs.name, jobId: jobs.id })
      .from(milestones)
      .innerJoin(jobs, eq(milestones.jobId, jobs.id))
      .where(and(eq(milestones.orgId, orgId), isNotNull(milestones.completedAt), onlyJobs ? inArray(milestones.jobId, onlyJobs) : undefined))
      .orderBy(desc(milestones.completedAt))
      .limit(PER_SOURCE_LIMIT);

    return rows
      .filter((row) => row.milestone.completedAt !== null)
      .map((row) => ({
        type: "milestone_completed",
        message: `Milestone "${row.milestone.name}" completed on ${row.jobName}`,
        link: `/jobs/${row.jobId}`,
        occurredAt: row.milestone.completedAt!.toISOString(),
      }));
  }
}
