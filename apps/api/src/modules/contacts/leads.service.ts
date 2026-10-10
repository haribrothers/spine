import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ActivityType, createLeadSchema, LeadHistoryEntry, updateLeadSchema } from "@spine/shared";
import { and, asc, desc, eq, getTableColumns, inArray, isNull, isNotNull, max, sql } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { activities, leads, leadStages, member } from "../../db/schema";
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
    const rows = await this.db
      .select(this.columns)
      .from(leads)
      .innerJoin(leadStages, eq(leads.stageId, leadStages.id))
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt));
    return this.withActivity(orgId, rows);
  }

  /**
   * US-CRM-25 (D-211) — adds what the card needs from the lead's
   * activities: `lastActivityAt` (the latest one logged or done) and
   * `nextFollowUp` (the earliest open one with a due date), in two grouped
   * queries rather than one per lead.
   */
  private async withActivity<T extends { id: string }>(orgId: string, rows: T[]) {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const latest = await this.db
      .select({ leadId: activities.leadId, at: max(sql<Date>`greatest(${activities.createdAt}, coalesce(${activities.doneAt}, ${activities.createdAt}))`) })
      .from(activities)
      .where(and(eq(activities.orgId, orgId), inArray(activities.leadId, ids)))
      .groupBy(activities.leadId);
    const open = await this.db
      .selectDistinctOn([activities.leadId], { leadId: activities.leadId, id: activities.id, type: activities.type, dueAt: activities.dueAt })
      .from(activities)
      .where(and(eq(activities.orgId, orgId), inArray(activities.leadId, ids), isNull(activities.doneAt), isNotNull(activities.dueAt)))
      .orderBy(activities.leadId, asc(activities.dueAt), asc(activities.id));
    const lastBy = new Map(latest.map((r) => [r.leadId, r.at]));
    const nextBy = new Map(open.map((r) => [r.leadId, { id: r.id, type: r.type as ActivityType, dueAt: r.dueAt }]));
    return rows.map((row) => ({
      ...row,
      lastActivityAt: lastBy.get(row.id) ? new Date(lastBy.get(row.id)!) : null,
      nextFollowUp: nextBy.get(row.id) ?? null,
    }));
  }

  /** US-CRM-27 — the owner must be an active member of this organisation. */
  private async requireOwner(orgId: string, ownerUserId: string | null | undefined) {
    if (!ownerUserId) return;
    const [row] = await this.db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, ownerUserId), eq(member.isActive, true)));
    if (!row) throw new BadRequestException("Choose someone in your organisation.");
  }

  /**
   * US-CRM-27 — when the lead was created and each stage change, with who
   * and when, read from the audit log (D-211: no separate history table).
   * Stage names are today's names; a stage since deleted shows as null.
   */
  async history(orgId: string, id: string): Promise<LeadHistoryEntry[]> {
    await this.getOne(orgId, id);
    const stages = await this.db.select({ id: leadStages.id, name: leadStages.name }).from(leadStages).where(eq(leadStages.orgId, orgId));
    const names = new Map(stages.map((s) => [s.id, s.name]));
    const nameOf = (stageId: unknown) => (typeof stageId === "string" ? (names.get(stageId) ?? null) : null);
    const rows = await this.auditLog.listForEntity(orgId, "lead", id);
    const entries: LeadHistoryEntry[] = [];
    for (const row of rows) {
      const changes = (row.changes ?? []) as { field: string; from: unknown; to: unknown }[];
      const stage = changes.find((c) => c.field === "stageId");
      const at = row.createdAt.toISOString();
      if (row.action === "created") {
        entries.push({ at, actorName: row.actorName, kind: "created", fromStage: null, toStage: nameOf(stage?.to) });
      } else if (row.action === "updated" && stage) {
        entries.push({ at, actorName: row.actorName, kind: "stage", fromStage: nameOf(stage.from), toStage: nameOf(stage.to) });
      }
    }
    return entries;
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
    const rows = await this.db
      .select(this.columns)
      .from(leads)
      .innerJoin(leadStages, eq(leads.stageId, leadStages.id))
      .where(and(eq(leads.orgId, orgId), eq(leads.contactId, contactId)))
      .orderBy(desc(leads.createdAt), asc(leads.id));
    return this.withActivity(orgId, rows);
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
    const [withActivity] = await this.withActivity(orgId, [lead]);
    return withActivity!;
  }

  /** A stage's kind (US-CRM-26: a lost reason is kept only in a Lost stage). */
  private async stageKind(orgId: string, stageId: string) {
    const [row] = await this.db.select({ kind: leadStages.kind }).from(leadStages).where(and(eq(leadStages.orgId, orgId), eq(leadStages.id, stageId)));
    return row?.kind ?? null;
  }

  async create(orgId: string, actorUserId: string, input: CreateLeadInput) {
    await this.requireOwner(orgId, input.ownerUserId);
    const created = await this.db.transaction(async (tx) => {
      const stageId = input.stageId ?? (await this.leadStages.defaultStageId(orgId, tx));
      if (input.stageId) await this.leadStages.requireStage(orgId, input.stageId, tx);
      const isLost = (await this.stageKind(orgId, stageId)) === "lost";
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
          expectedCloseDate: input.expectedCloseDate ?? null,
          lostReason: isLost ? (input.lostReason ?? null) : null,
          lostNote: isLost ? (input.lostNote ?? null) : null,
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
          // US-CRM-27: the starting stage, for the lead's history.
          changes: [
            { field: "title", from: null, to: lead.title },
            { field: "stageId", from: null, to: lead.stageId },
          ],
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
    if (input.ownerUserId !== undefined) await this.requireOwner(orgId, input.ownerUserId);
    const stageChanged = input.stageId !== undefined && input.stageId !== existing.stageId;
    // US-CRM-26: the lost reason lives only while the lead is in a Lost stage.
    const isLost = (stageChanged ? await this.stageKind(orgId, input.stageId!) : existing.stageKind) === "lost";
    const lost = isLost
      ? {
          ...(input.lostReason !== undefined ? { lostReason: input.lostReason } : {}),
          ...(input.lostNote !== undefined ? { lostNote: input.lostNote } : {}),
        }
      : { lostReason: null, lostNote: null };
    const now = new Date();
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
          ...(input.expectedCloseDate !== undefined ? { expectedCloseDate: input.expectedCloseDate } : {}),
          ...lost,
          ...(stageChanged ? { stageChangedAt: now } : {}),
          updatedAt: now,
        })
        .where(eq(leads.id, id))
        .returning();
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, { ...input, ...lost } as Record<string, unknown>);
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
