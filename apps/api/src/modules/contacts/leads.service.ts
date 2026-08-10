import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createLeadSchema, updateLeadSchema } from "@spine/shared";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { leads, leadStageEnum } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type LeadStage = (typeof leadStageEnum.enumValues)[number];

/**
 * Leads CRUD. Stage is the fixed enum from db/schema/contacts.ts (see that
 * file's comment on why true per-org configurable stages are deferred).
 * `list(orgId)` with no stage filter returns every lead in the org, which
 * is what the /leads kanban board (S-01.5, apps/web's leads-board.tsx)
 * groups into columns client-side.
 */
@Injectable()
export class LeadsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(orgId: string, stage?: LeadStage) {
    const conditions = [eq(leads.orgId, orgId)];
    if (stage) conditions.push(eq(leads.stage, stage));
    return this.db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt));
  }

  /**
   * S-09.11 (dashboard v2) — "pipeline by stage" chart. A server-side
   * GROUP BY, unlike the /leads kanban board (S-01.5), which groups its
   * own `list(orgId)` client-side — that board already has every lead's
   * full row in memory for drag-and-drop, so a second aggregate query
   * would be redundant there; the dashboard widget wants only the totals,
   * not every lead row, so a real GROUP BY is the right shape here.
   * Zero-filled for every `leadStageEnum` value so the chart always
   * renders all 5 stages, even ones with no leads yet, rather than a
   * shifting set of bars.
   */
  async summaryByStage(orgId: string) {
    const rows = await this.db
      .select({ stage: leads.stage, valueAmount: leads.valueAmount })
      .from(leads)
      .where(eq(leads.orgId, orgId));

    const byStage = new Map<string, { count: number; totalValue: bigint }>();
    for (const stage of leadStageEnum.enumValues) {
      byStage.set(stage, { count: 0, totalValue: 0n });
    }
    for (const row of rows) {
      const existing = byStage.get(row.stage)!;
      existing.count += 1;
      existing.totalValue += row.valueAmount;
    }

    return leadStageEnum.enumValues.map((stage) => ({
      stage,
      count: byStage.get(stage)!.count,
      totalValue: byStage.get(stage)!.totalValue.toString(),
    }));
  }

  async listByContact(orgId: string, contactId: string) {
    return this.db
      .select()
      .from(leads)
      .where(and(eq(leads.orgId, orgId), eq(leads.contactId, contactId)))
      .orderBy(desc(leads.createdAt));
  }

  async getOne(orgId: string, id: string) {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.orgId, orgId), eq(leads.id, id)));
    if (!lead) {
      throw new NotFoundException("Lead not found");
    }
    return lead;
  }

  async create(orgId: string, actorUserId: string, input: CreateLeadInput) {
    const created = await this.db.transaction(async (tx) => {
      const [lead] = await tx
        .insert(leads)
        .values({
          orgId,
          contactId: input.contactId,
          stage: input.stage ?? "new",
          valueAmount: input.valueAmount ?? 0n,
          valueCurrency: input.valueCurrency,
          source: input.source ?? null,
          ownerUserId: input.ownerUserId ?? null,
          title: input.title ?? null,
        })
        .returning();
      if (lead) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "created",
          entityType: "lead",
          entityId: lead.id,
          contactId: lead.contactId,
          changes: [{ field: "title", from: null, to: lead.title }],
        });
      }
      return lead;
    });
    return created;
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateLeadInput) {
    const existing = await this.getOne(orgId, id);
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(leads)
        .set({
          ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
          ...(input.stage !== undefined ? { stage: input.stage } : {}),
          ...(input.valueAmount !== undefined ? { valueAmount: input.valueAmount } : {}),
          ...(input.valueCurrency !== undefined ? { valueCurrency: input.valueCurrency } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, id))
        .returning();
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, input as Record<string, unknown>);
      if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "lead",
          entityId: id,
          contactId: existing.contactId,
          changes,
        });
      }
      return row;
    });
    return updated;
  }

  async delete(orgId: string, id: string, actorUserId: string) {
    const existing = await this.getOne(orgId, id);
    await this.db.transaction(async (tx) => {
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "lead",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "title", from: existing.title, to: null }],
      });
      await tx.delete(leads).where(eq(leads.id, id));
    });
    return { id };
  }
}
