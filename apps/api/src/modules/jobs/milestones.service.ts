import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { completeMilestoneSchema, setMilestonesSchema } from "@spine/shared";
import { roundHalfUp } from "@spine/shared";
import { and, eq, lte } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { jobs, milestones, jobPhotos } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { InvoicesService } from "../invoices/invoices.service";
import { NotificationsService } from "../notifications/notifications.service";
import { requireOwnershipCapability } from "../../auth/capability.util";

export type SetMilestonesInput = z.infer<typeof setMilestonesSchema>;
export type CompleteMilestoneInput = z.infer<typeof completeMilestoneSchema>;

interface ResolvedMilestone {
  id?: string;
  name: string;
  sequence: number;
  amountType: "fixed" | "percent";
  amount: number;
  resolvedAmount: bigint;
  dueDate: Date | null;
}

/**
 * S-04.2/S-04.3 — defines a job's billing milestones as a whole set
 * (full-replace, same convention as QuoteLines/InvoiceLines: the client
 * always sends the complete list, this service deletes and re-inserts
 * rather than diffing row-by-row) and enforces "percentages must total
 * 100%" BEFORE writing anything, so a bad set never partially lands.
 *
 * The 100% rule applies ONLY to `percent`-type milestones — a job billed
 * entirely in `fixed` amounts (or a mix) has no PRD-mandated total to
 * check against (S-04.3's own wording is "my milestone percentages don't
 * total 100%," not "my milestone amounts don't total the contract value"),
 * so a job can legitimately have fixed milestones that sum to more or less
 * than the contract value (e.g. billing a fixed retainer alongside
 * percentage-based stage payments) without tripping this guard. If a job
 * has ANY percent-type milestones, those percentages together must sum to
 * exactly 100 — partial percentage coverage (e.g. one 50% milestone and
 * nothing else) is exactly the "under-bill" scenario S-04.3 exists to
 * prevent.
 */
@Injectable()
export class MilestonesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly invoices: InvoicesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(orgId: string, jobId: string) {
    await this.requireJob(orgId, jobId);
    return this.db.select().from(milestones).where(eq(milestones.jobId, jobId)).orderBy(milestones.sequence);
  }

  /**
   * S-09.12 (dashboard v2) — "job milestones due," across every job, not
   * one at a time. No cross-job milestone query existed before this —
   * `list` above is deliberately job-scoped (it's used by the job detail
   * page's Milestones tab). Only `pending` milestones are "due" — a
   * `completed`/`invoiced` milestone has nothing left to act on, even if
   * its `dueDate` is in the past. Includes overdue (`dueDate` before
   * today) as well as due within `withinDays`, both sorted soonest/most-
   * overdue first, so the dashboard widget doesn't need a second query for
   * the overdue case.
   */
  async dueAcrossJobs(orgId: string, options: { withinDays?: number } = {}) {
    const withinDays = options.withinDays ?? 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + withinDays);

    const rows = await this.db
      .select({ milestone: milestones, jobName: jobs.name, jobContactId: jobs.contactId, jobCurrency: jobs.currency })
      .from(milestones)
      .innerJoin(jobs, eq(milestones.jobId, jobs.id))
      .where(and(eq(milestones.orgId, orgId), eq(milestones.status, "pending"), lte(milestones.dueDate, horizon)))
      .orderBy(milestones.dueDate);

    return rows
      .filter((row) => row.milestone.dueDate !== null)
      .map((row) => ({
        milestoneId: row.milestone.id,
        jobId: row.milestone.jobId,
        jobName: row.jobName,
        jobContactId: row.jobContactId,
        currency: row.jobCurrency,
        name: row.milestone.name,
        dueDate: row.milestone.dueDate,
        isOverdue: row.milestone.dueDate !== null && row.milestone.dueDate < today,
      }));
  }

  async getOne(orgId: string, jobId: string, milestoneId: string) {
    const [row] = await this.db
      .select()
      .from(milestones)
      .where(and(eq(milestones.orgId, orgId), eq(milestones.jobId, jobId), eq(milestones.id, milestoneId)));
    if (!row) {
      throw new NotFoundException("Milestone not found");
    }
    return row;
  }

  /**
   * Replaces the job's entire milestone set. Refuses to touch any
   * milestone that's already `invoiced` (S-04.5 makes a milestone's
   * invoiced state a one-way fact, per milestones.ts's own doc comment) —
   * an already-invoiced milestone must be included, unchanged, in the
   * submitted set, or this call rejects outright rather than silently
   * dropping billing history.
   *
   * Ownership ("own" vs "others") for `milestones.edit_own`/`edit_others`
   * is keyed off who last replaced the set (any existing row's
   * `createdByUserId` — they're all written together in the transaction
   * below, so any one row reflects the whole set's owner), not per-row.
   * A job with no milestones yet has no owner, so `_own` never applies to
   * the first-ever call — only `_others` gates it, same "unowned record"
   * rule every other own/others module uses for a null creator.
   */
  async setAll(orgId: string, jobId: string, actorUserId: string, input: SetMilestonesInput) {
    const job = await this.requireJob(orgId, jobId);

    const existing = await this.db.select().from(milestones).where(eq(milestones.jobId, jobId));

    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing[0]?.createdByUserId ?? null, {
      own: "milestones.edit_own",
      others: "milestones.edit_others",
    });
    const invoicedIds = new Set(existing.filter((m) => m.status === "invoiced").map((m) => m.id));
    for (const invoicedId of invoicedIds) {
      if (!input.milestones.some((m) => m.id === invoicedId)) {
        throw new BadRequestException("Cannot remove a milestone that has already been invoiced");
      }
    }

    const percentTotal = input.milestones.filter((m) => m.amountType === "percent").reduce((sum, m) => sum + m.amount, 0);
    if (input.milestones.some((m) => m.amountType === "percent") && Math.round(percentTotal * 100) !== 10000) {
      throw new BadRequestException(`Milestone percentages must total 100% (currently ${percentTotal}%)`);
    }

    const resolved: ResolvedMilestone[] = input.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      sequence: m.sequence,
      amountType: m.amountType,
      amount: m.amount,
      resolvedAmount:
        m.amountType === "percent" ? roundHalfUp((Number(job.contractValueAmount) * m.amount) / 100) : roundHalfUp(m.amount),
      dueDate: m.dueDate ?? null,
    }));

    await this.db.transaction(async (tx) => {
      const existingById = new Map(existing.map((m) => [m.id, m]));

      await tx.delete(milestones).where(and(eq(milestones.jobId, jobId), eq(milestones.status, "pending")));

      for (const m of resolved) {
        if (m.id && existingById.has(m.id)) {
          await tx
            .update(milestones)
            .set({
              name: m.name,
              sequence: m.sequence,
              amountType: m.amountType,
              amount: m.amount,
              resolvedAmount: m.resolvedAmount,
              dueDate: m.dueDate,
              createdByUserId: actorUserId,
              updatedAt: new Date(),
            })
            .where(eq(milestones.id, m.id));
        } else {
          await tx.insert(milestones).values({
            jobId,
            orgId,
            name: m.name,
            sequence: m.sequence,
            amountType: m.amountType,
            amount: m.amount,
            resolvedAmount: m.resolvedAmount,
            dueDate: m.dueDate,
            createdByUserId: actorUserId,
          });
        }
      }

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "milestones_set",
        entityType: "job",
        entityId: jobId,
        contactId: job.contactId,
        changes: [{ field: "milestoneCount", from: existing.length, to: resolved.length }],
      });
    });

    return this.list(orgId, jobId);
  }

  /**
   * S-04.4 — "mark a milestone as complete with photos, so office staff
   * can raise the invoice." Web-only for now (mobile capture is Phase 5,
   * per the PRD's own phase breakdown — see CHANGELOG). Only a `pending`
   * milestone can be completed (an `invoiced` one is already past this
   * point; re-completing a `completed` one is a no-op the UI shouldn't
   * offer, guarded here anyway since this is a server-enforced boundary,
   * not just a UI affordance). Photos are attached via `job_photos` with
   * `milestoneId` set (see jobs.ts's own doc comment on that column) — the
   * files themselves are already-uploaded `files` rows (`POST /files`),
   * referenced here by id, matching every other file-attaching flow in
   * this codebase.
   */
  async completeMilestone(orgId: string, jobId: string, milestoneId: string, actorUserId: string, input: CompleteMilestoneInput) {
    const job = await this.requireJob(orgId, jobId);
    const milestone = await this.getOne(orgId, jobId, milestoneId);

    if (milestone.status !== "pending") {
      throw new BadRequestException("Only a pending milestone can be marked complete");
    }

    await requireOwnershipCapability(
      this.db,
      { orgId, userId: actorUserId },
      milestone.createdByUserId,
      { own: "milestones.edit_own", others: "milestones.edit_others" },
      "always",
    );

    await this.db.transaction(async (tx) => {
      const completedAt = new Date();
      await tx
        .update(milestones)
        .set({ status: "completed", completedByUserId: actorUserId, completedAt, completionNotes: input.completionNotes ?? null, updatedAt: completedAt })
        .where(eq(milestones.id, milestoneId));

      if (input.photoFileIds.length) {
        await tx.insert(jobPhotos).values(
          input.photoFileIds.map((fileId) => ({
            jobId,
            orgId,
            milestoneId,
            fileId,
            uploadedByUserId: actorUserId,
            createdByUserId: actorUserId,
          })),
        );
      }

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "milestone_completed",
        entityType: "milestone",
        entityId: milestoneId,
        contactId: job.contactId,
        changes: [{ field: "status", from: "pending", to: "completed" }],
      });
    });

    void this.notifications.notify(orgId, {
      subject: `Milestone completed — ${milestone.name}`,
      text: `Milestone "${milestone.name}" on job "${job.name}" was marked completed.`,
      recipientRoles: ["owner", "staff"],
      inApp: {
        type: "milestone_completed",
        message: `Milestone "${milestone.name}" completed on ${job.name}`,
        link: `/jobs/${jobId}`,
      },
    });

    return this.getOne(orgId, jobId, milestoneId);
  }

  /**
   * S-04.5 / S-05.1's milestone path — "raise a progress invoice directly
   * from a completed milestone." Only a `completed` milestone can be
   * invoiced (a `pending` one has nothing done to bill for yet; an
   * already-`invoiced` one is the one-shot guard from milestones.ts's own
   * doc comment). Retention (S-04.6) is applied here — `job.retentionPct`
   * times the milestone's own `resolvedAmount`, rounded the same
   * half-up-at-line-level way every other money computation in this
   * codebase works — and passed through to
   * `InvoicesService.createFromMilestone`, which stores it on the new
   * invoice's own `retentionAmount` column for `issue()` to post against.
   * The milestone flips to `invoiced` and records the new invoice's id
   * immediately after invoice creation succeeds — two sequential writes,
   * not one shared transaction (InvoicesService.createFromMilestone owns
   * its own transaction boundary, matching every other cross-service call
   * in this codebase, e.g. QuotesService.send enqueuing a queue job after
   * its own commit). Retry-safety against a client retrying this exact
   * call (e.g. after a dropped response) is `IdempotencyInterceptor`'s job
   * at the controller layer, per CLAUDE.md's "idempotency keys on all
   * mutating endpoints" rule — not a manual re-entrancy guard here.
   */
  async invoiceMilestone(orgId: string, jobId: string, milestoneId: string, actorUserId: string) {
    const job = await this.requireJob(orgId, jobId);
    const milestone = await this.getOne(orgId, jobId, milestoneId);

    if (milestone.status !== "completed") {
      throw new BadRequestException("Only a completed milestone can be invoiced");
    }

    const retentionAmount = job.retentionPct > 0 ? roundHalfUp((Number(milestone.resolvedAmount) * job.retentionPct) / 100) : 0n;

    const invoice = await this.invoices.createFromMilestone(orgId, actorUserId, {
      jobId,
      milestoneId,
      contactId: job.contactId,
      currency: job.currency,
      name: `${job.name} — ${milestone.name}`,
      amount: milestone.resolvedAmount,
      retentionAmount,
    });

    await this.db
      .update(milestones)
      .set({ status: "invoiced", invoicedInvoiceId: invoice.id, updatedAt: new Date() })
      .where(eq(milestones.id, milestoneId));

    await this.auditLog.record(this.db, {
      orgId,
      actorUserId,
      action: "milestone_invoiced",
      entityType: "milestone",
      entityId: milestoneId,
      contactId: job.contactId,
      changes: [
        { field: "status", from: "completed", to: "invoiced" },
        { field: "invoicedInvoiceId", from: null, to: invoice.id },
      ],
    });

    return invoice;
  }

  /**
   * Recomputes every `pending`/`completed` milestone's `resolvedAmount`
   * against a job's current `contractValueAmount` — called by
   * VariationOrdersService (Stage 3) after a variation order changes the
   * contract value, so percentage-based milestones keep billing against
   * the right base. `invoiced` milestones are untouched (their invoice's
   * own amount is already a permanent snapshot, per CLAUDE.md).
   */
  async recomputeResolvedAmounts(tx: Transaction, orgId: string, jobId: string, newContractValueAmount: bigint) {
    const rows = await tx.select().from(milestones).where(and(eq(milestones.jobId, jobId), eq(milestones.orgId, orgId)));
    for (const m of rows) {
      if (m.status === "invoiced" || m.amountType !== "percent") continue;
      const resolvedAmount = roundHalfUp((Number(newContractValueAmount) * m.amount) / 100);
      await tx.update(milestones).set({ resolvedAmount, updatedAt: new Date() }).where(eq(milestones.id, m.id));
    }
  }

  private async requireJob(orgId: string, jobId: string) {
    const [job] = await this.db.select().from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.id, jobId)));
    if (!job) {
      throw new NotFoundException("Job not found");
    }
    return job;
  }
}
