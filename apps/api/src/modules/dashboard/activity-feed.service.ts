import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { activityMessage, formatMoney, groupQuoteViews, type ActivityFeedActor, type ActivityFeedEntry, type ActivityFeedPart } from "@spine/shared";
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
  user,
} from "../../db/schema";

export type { ActivityFeedEntry };

function entry(type: string, actor: ActivityFeedActor | null, parts: ActivityFeedPart[], link: string | null, at: Date, groupCount?: number): ActivityFeedEntry {
  return { type, actor, parts, message: activityMessage(actor, parts, groupCount), ...(groupCount && groupCount > 1 ? { groupCount } : {}), link, occurredAt: at.toISOString() };
}

const member = (name: string | null): ActivityFeedActor | null => (name ? { name, kind: "member" } : null);

const FEED_LIMIT = 30;
/** Per-source fetch cap before merging — generous enough that a busy org's most recent 30 overall entries are never missed just because one source alone had >30 rows in between. */
const PER_SOURCE_LIMIT = 100;

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
  async list(orgId: string, role: string | null, userId?: string, limit = FEED_LIMIT): Promise<ActivityFeedEntry[]> {
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
      .slice(0, limit);
  }

  /** US-DASH-19 — the customer viewed (grouped within 24 hours) or accepted a quote. */
  private async quoteEventEntries(orgId: string): Promise<ActivityFeedEntry[]> {
    const rows = await this.db
      .select({ event: quoteEvents, quoteNumber: quotes.number, quoteId: quotes.id, total: quotes.totalAmount, currency: quotes.currency, customer: contacts.name })
      .from(quoteEvents)
      .innerJoin(quotes, eq(quoteEvents.quoteId, quotes.id))
      .leftJoin(contacts, eq(quotes.contactId, contacts.id))
      .where(and(eq(quoteEvents.orgId, orgId), inArray(quoteEvents.type, ["viewed", "accepted"])))
      .orderBy(desc(quoteEvents.createdAt))
      .limit(PER_SOURCE_LIMIT * 3);

    const locale = await orgLocale(this.db, orgId);
    const customer = (name: string | null): ActivityFeedActor | null => (name ? { name, kind: "customer" } : null);
    const views = groupQuoteViews(rows.filter((r) => r.event.type === "viewed").map((r) => ({ ...r, at: r.event.createdAt })));
    const accepted = rows.filter((r) => r.event.type === "accepted");
    return [
      ...views.map((r) => entry("quote_viewed", customer(r.customer), [{ text: `viewed ${r.quoteNumber ?? "a draft quote"}` }], `/quotes/${r.quoteId}`, r.at, r.count)),
      ...accepted.map((r) =>
        entry(
          "quote_accepted",
          customer(r.customer),
          [{ text: `accepted ${r.quoteNumber ?? "a quote"} · ` }, { text: formatMoney(r.total, r.currency, locale), strong: true }],
          `/quotes/${r.quoteId}`,
          r.event.createdAt,
        ),
      ),
    ].slice(0, PER_SOURCE_LIMIT);
  }

  private async paymentEntries(orgId: string): Promise<ActivityFeedEntry[]> {
    const rows = await this.db
      .select({ payment: payments, contactName: contacts.name, recordedBy: user.name })
      .from(payments)
      .innerJoin(contacts, eq(payments.contactId, contacts.id))
      .leftJoin(user, eq(payments.createdByUserId, user.id))
      .where(eq(payments.orgId, orgId))
      .orderBy(desc(payments.createdAt))
      .limit(PER_SOURCE_LIMIT);

    const locale = await orgLocale(this.db, orgId);
    return rows.map((row) => {
      const amount = { text: formatMoney(row.payment.amount, row.payment.currency, locale), strong: true };
      const parts = row.recordedBy
        ? [{ text: "recorded a payment of " }, amount, { text: ` from ${row.contactName}` }]
        : [{ text: "Payment of " }, amount, { text: ` received from ${row.contactName}` }];
      return entry("payment_received", member(row.recordedBy), parts, `/payments?id=${row.payment.id}`, row.payment.createdAt);
    });
  }

  /** US-DASH-19 — "Sarah Mendes submitted an expense · Travel · $85.00", and who approved it. */
  private async expenseEntries(orgId: string): Promise<ActivityFeedEntry[]> {
    const submitter = alias(user, "submitter");
    const approver = alias(user, "approver");
    const rows = await this.db
      .select({ expense: expenses, categoryName: expenseCategories.name, submittedBy: submitter.name, approvedBy: approver.name })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(submitter, eq(expenses.submittedByUserId, submitter.id))
      .leftJoin(approver, eq(expenses.approvedByUserId, approver.id))
      .where(eq(expenses.orgId, orgId))
      .orderBy(desc(expenses.createdAt))
      .limit(PER_SOURCE_LIMIT);

    const locale = await orgLocale(this.db, orgId);
    const out: ActivityFeedEntry[] = [];
    for (const row of rows) {
      const amount = { text: formatMoney(row.expense.amount, row.expense.currency, locale), strong: true };
      const link = `/expenses?id=${row.expense.id}`;
      out.push(entry("expense_submitted", member(row.submittedBy), [{ text: `${row.submittedBy ? "submitted an expense" : "Expense submitted"} · ${row.categoryName} · ` }, amount], link, row.expense.createdAt));
      if (row.expense.status === "approved" && row.expense.approvedAt) {
        out.push(entry("expense_approved", member(row.approvedBy), [{ text: `${row.approvedBy ? "approved an expense" : "Expense approved"} · ${row.categoryName} · ` }, amount], link, row.expense.approvedAt));
      }
    }
    return out;
  }

  private async jobEntries(orgId: string, onlyJobs: string[] | null): Promise<ActivityFeedEntry[]> {
    const rows = await this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.orgId, orgId), eq(jobs.status, "completed"), onlyJobs ? inArray(jobs.id, onlyJobs) : undefined))
      .orderBy(desc(jobs.updatedAt))
      .limit(PER_SOURCE_LIMIT);

    return rows.map((row) => entry("job_completed", null, [{ text: `${row.name} was marked completed` }], `/jobs/${row.id}`, row.updatedAt));
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
      .select({ milestone: milestones, jobName: jobs.name, jobId: jobs.id, completedBy: user.name })
      .from(milestones)
      .innerJoin(jobs, eq(milestones.jobId, jobs.id))
      .leftJoin(user, eq(milestones.completedByUserId, user.id))
      .where(and(eq(milestones.orgId, orgId), isNotNull(milestones.completedAt), onlyJobs ? inArray(milestones.jobId, onlyJobs) : undefined))
      .orderBy(desc(milestones.completedAt))
      .limit(PER_SOURCE_LIMIT);

    return rows
      .filter((row) => row.milestone.completedAt !== null)
      .map((row) =>
        entry(
          "milestone_completed",
          member(row.completedBy),
          [{ text: row.completedBy ? `completed ${row.milestone.name} on ${row.jobName}` : `Milestone ${row.milestone.name} completed on ${row.jobName}` }],
          `/jobs/${row.jobId}`,
          row.milestone.completedAt!,
        ),
      );
  }
}
