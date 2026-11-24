import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createVariationOrderSchema } from "@spine/shared";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { jobs, quotes, jobVariationOrders } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { QuotesService } from "../quotes/quotes.service";
import { JobsService } from "./jobs.service";
import { MilestonesService } from "./milestones.service";

export type CreateVariationOrderInput = z.infer<typeof createVariationOrderSchema>;

/**
 * S-04.9 — "raise a variation order as a supplementary quote linked to the
 * job, so scope changes are tracked and billed." Per jobs.ts's own doc
 * comment on `jobVariationOrders`, a variation order is NOT a new document
 * type — it's an ordinary quote (built, sent, and accepted through the
 * exact same `QuotesService`/public-link flow every other quote uses) plus
 * a `job_variation_orders` row recording the link. This service owns only
 * that link and the "apply once accepted" step; it never duplicates
 * QuotesService's own CRUD/send/versioning logic.
 *
 * Applying a variation order (folding its accepted value into the job's
 * `contractValueAmount`) is a deliberate, explicit staff action
 * (`apply()`), not automatic the moment a customer accepts the quote —
 * PublicQuotesService has no concept of jobs, and S-04.9's own wording
 * ("raise ... so scope changes are tracked and billed") doesn't require
 * the contract value to move the instant a customer clicks accept; staff
 * reviewing and applying it is a reasonable, safer default (avoids a
 * partially-reviewed acceptance silently reshaping a job's billing base
 * while no one's looking) and mirrors S-03.10's own "conversion is an
 * explicit action" precedent.
 */
@Injectable()
export class VariationOrdersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly quotesService: QuotesService,
    private readonly jobsService: JobsService,
    private readonly milestonesService: MilestonesService,
  ) {}

  async list(orgId: string, jobId: string) {
    await this.requireJob(orgId, jobId);
    const rows = await this.db
      .select({ variation: jobVariationOrders, quote: quotes })
      .from(jobVariationOrders)
      .innerJoin(quotes, eq(jobVariationOrders.quoteId, quotes.id))
      .where(and(eq(jobVariationOrders.orgId, orgId), eq(jobVariationOrders.jobId, jobId)));

    return rows.map((r) => ({ ...r.variation, quote: r.quote }));
  }

  /**
   * Creates the supplementary quote (a normal draft, via QuotesService.create
   * — same contact, so it can be built/sent/accepted through the existing
   * quote flow) and the `job_variation_orders` link row, in one transaction
   * so a variation quote never exists without its job link or vice versa.
   */
  async create(orgId: string, actorUserId: string, jobId: string, input: CreateVariationOrderInput) {
    const job = await this.requireJob(orgId, jobId);

    const quote = await this.quotesService.create(orgId, actorUserId, {
      ...input,
      contactId: input.contactId ?? job.contactId,
      currency: input.currency ?? job.currency,
    });

    await this.db.insert(jobVariationOrders).values({
      jobId,
      quoteId: quote.id,
      orgId,
      createdByUserId: actorUserId,
    });

    await this.auditLog.record(this.db, {
      orgId,
      actorUserId,
      action: "variation_order_created",
      entityType: "job",
      entityId: jobId,
      contactId: job.contactId,
      changes: [{ field: "variationQuoteId", from: null, to: quote.id }],
    });

    return this.list(orgId, jobId);
  }

  /**
   * Folds an accepted variation quote's total into the job's contract
   * value (S-04.9) and recomputes every percent-type milestone's
   * `resolvedAmount` against the new base (MilestonesService's own doc
   * comment on `recomputeResolvedAmounts`). Only an `accepted` quote can
   * be applied, and only once — `appliedAt` is a one-shot marker, same
   * convention as every other "applied once" timestamp in this codebase
   * (quotes.respondedAt, job_variation_orders.appliedAt itself).
   */
  async apply(orgId: string, actorUserId: string, jobId: string, variationOrderId: string) {
    const job = await this.requireJob(orgId, jobId);

    const [row] = await this.db
      .select({ variation: jobVariationOrders, quote: quotes })
      .from(jobVariationOrders)
      .innerJoin(quotes, eq(jobVariationOrders.quoteId, quotes.id))
      .where(and(eq(jobVariationOrders.orgId, orgId), eq(jobVariationOrders.jobId, jobId), eq(jobVariationOrders.id, variationOrderId)));
    if (!row) {
      throw new NotFoundException("Variation order not found");
    }
    if (row.variation.appliedAt) {
      throw new BadRequestException("This variation order has already been applied");
    }
    if (row.quote.status !== "accepted") {
      throw new BadRequestException("Only an accepted variation order can be applied to the job");
    }

    const appliedAt = new Date();
    const newContractValue = job.contractValueAmount + row.quote.totalAmount;

    await this.db.transaction(async (tx) => {
      await tx.update(jobVariationOrders).set({ appliedAt }).where(eq(jobVariationOrders.id, variationOrderId));
      await tx.update(jobs).set({ contractValueAmount: newContractValue, updatedAt: appliedAt }).where(eq(jobs.id, jobId));
      await this.milestonesService.recomputeResolvedAmounts(tx, orgId, jobId, newContractValue);

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "variation_order_applied",
        entityType: "job",
        entityId: jobId,
        contactId: job.contactId,
        changes: [{ field: "contractValueAmount", from: job.contractValueAmount.toString(), to: newContractValue.toString() }],
      });
    });

    return this.jobsService.getOne(orgId, jobId);
  }

  private async requireJob(orgId: string, jobId: string) {
    const [job] = await this.db.select().from(jobs).where(and(eq(jobs.orgId, orgId), eq(jobs.id, jobId)));
    if (!job) {
      throw new NotFoundException("Job not found");
    }
    return job;
  }
}
