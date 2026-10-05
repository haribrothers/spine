import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createLeadSchema, updateLeadSchema } from "@spine/shared";
import { and, asc, desc, eq, getTableColumns } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { leads, leadStages } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { requireOwnershipCapability } from "../../auth/capability.util";
import { LeadStagesService } from "./lead-stages.service";

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

/**
 * Leads CRUD. A lead sits in one of the organisation's pipeline stages
 * (US-CRM-19, `lead_stages`); every read adds the stage's `stageName` and
 * `stageKind` so lists and reports can tell open leads from won and lost
 * ones without a second request. `list(orgId)` with no stage filter
 * returns every lead in the org, which the /leads board groups into
 * columns client-side.
 */
@Injectable()
export class LeadsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly leadStages: LeadStagesService,
  ) {}

  /** Lead columns plus the stage's name and kind. */
  private readonly columns = { ...getTableColumns(leads), stageName: leadStages.name, stageKind: leadStages.kind };

  async list(orgId: string, stageId?: string) {
    const conditions = [eq(leads.orgId, orgId)];
    if (stageId) conditions.push(eq(leads.stageId, stageId));
    return this.db
      .select(this.columns)
      .from(leads)
      .innerJoin(leadStages, eq(leads.stageId, leadStages.id))
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt));
  }

  /**
   * S-09.11 (dashboard v2) — "pipeline by stage" chart, one row per stage in
   * board order (zero-filled, so the chart always shows every stage), with
   * the stage's kind so won and lost are told apart whatever they're called.
   */
  async summaryByStage(orgId: string) {
    const stages = await this.leadStages.list(orgId);
    const rows = await this.db.select({ stageId: leads.stageId, valueAmount: leads.valueAmount }).from(leads).where(eq(leads.orgId, orgId));
    const totals = new Map<string, bigint>();
    for (const row of rows) totals.set(row.stageId, (totals.get(row.stageId) ?? 0n) + row.valueAmount);
    return stages.map((stage) => ({
      stageId: stage.id,
      name: stage.name,
      kind: stage.kind,
      color: stage.color,
      count: stage.leadCount,
      totalValue: (totals.get(stage.id) ?? 0n).toString(),
    }));
  }

  async listByContact(orgId: string, contactId: string) {
    return this.db
      .select(this.columns)
      .from(leads)
      .innerJoin(leadStages, eq(leads.stageId, leadStages.id))
      .where(and(eq(leads.orgId, orgId), eq(leads.contactId, contactId)))
      .orderBy(desc(leads.createdAt), asc(leads.id));
  }

  async getOne(orgId: string, id: string) {
    const [lead] = await this.db
      .select(this.columns)
      .from(leads)
      .innerJoin(leadStages, eq(leads.stageId, leadStages.id))
      .where(and(eq(leads.orgId, orgId), eq(leads.id, id)));
    if (!lead) {
      throw new NotFoundException("Lead not found");
    }
    return lead;
  }

  async create(orgId: string, actorUserId: string, input: CreateLeadInput) {
    const created = await this.db.transaction(async (tx) => {
      const stageId = input.stageId ?? (await this.leadStages.defaultStageId(orgId, tx));
      if (input.stageId) await this.leadStages.requireStage(orgId, input.stageId, tx);
      const [lead] = await tx
        .insert(leads)
        .values({
          orgId,
          contactId: input.contactId,
          stageId,
          valueAmount: input.valueAmount ?? 0n,
          valueCurrency: input.valueCurrency,
          source: input.source ?? null,
          ownerUserId: input.ownerUserId ?? null,
          title: input.title ?? null,
          createdByUserId: actorUserId,
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
    return created ? this.getOne(orgId, created.id) : created;
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateLeadInput) {
    const existing = await this.getOne(orgId, id);
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "leads.edit_own",
      others: "leads.edit_others",
    });
    if (input.stageId !== undefined) await this.leadStages.requireStage(orgId, input.stageId);
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(leads)
        .set({
          ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
          ...(input.stageId !== undefined ? { stageId: input.stageId } : {}),
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
    return updated ? this.getOne(orgId, updated.id) : updated;
  }

  async delete(orgId: string, id: string, actorUserId: string) {
    const existing = await this.getOne(orgId, id);
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.createdByUserId, {
      own: "leads.delete_own",
      others: "leads.delete_others",
    });
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
