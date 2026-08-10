import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { setMilestonesSchema } from "@spine/shared";
import { roundHalfUp } from "@spine/shared";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database, Transaction } from "../../db/client";
import { jobs, milestones } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

export type SetMilestonesInput = z.infer<typeof setMilestonesSchema>;

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
  ) {}

  async list(orgId: string, jobId: string) {
    await this.requireJob(orgId, jobId);
    return this.db.select().from(milestones).where(eq(milestones.jobId, jobId)).orderBy(milestones.sequence);
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
   */
  async setAll(orgId: string, jobId: string, actorUserId: string, input: SetMilestonesInput) {
    const job = await this.requireJob(orgId, jobId);

    const existing = await this.db.select().from(milestones).where(eq(milestones.jobId, jobId));
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
