import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createActivitySchema, updateActivitySchema } from "@spine/shared";
import { and, asc, desc, eq, isNull, lt } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { activities, leads } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

/**
 * Activities CRUD + "mark done" + the overdue-follow-ups query (S-01.7:
 * "a list of overdue follow-ups on my dashboard" — scoped to the requesting
 * user via `assignedToUserId`, per the brief's reading of "my").
 */
@Injectable()
export class ActivitiesService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Audit's `contactId` is populated straight from `activity.contactId`
   * when set; an activity linked only to a lead (no direct contactId) is
   * resolved through that lead's own contactId instead, so an
   * activity-on-a-lead still shows up in the owning contact's history tab.
   */
  private async resolveContactId(orgId: string, activity: { contactId: string | null; leadId: string | null }) {
    if (activity.contactId) return activity.contactId;
    if (!activity.leadId) return null;
    const [lead] = await this.db.select({ contactId: leads.contactId }).from(leads).where(and(eq(leads.orgId, orgId), eq(leads.id, activity.leadId)));
    return lead?.contactId ?? null;
  }

  async list(orgId: string, filters: { contactId?: string; leadId?: string }) {
    const conditions = [eq(activities.orgId, orgId)];
    if (filters.contactId) conditions.push(eq(activities.contactId, filters.contactId));
    if (filters.leadId) conditions.push(eq(activities.leadId, filters.leadId));
    return this.db
      .select()
      .from(activities)
      .where(and(...conditions))
      .orderBy(desc(activities.createdAt));
  }

  async getOne(orgId: string, id: string) {
    const [activity] = await this.db
      .select()
      .from(activities)
      .where(and(eq(activities.orgId, orgId), eq(activities.id, id)));
    if (!activity) {
      throw new NotFoundException("Activity not found");
    }
    return activity;
  }

  async create(orgId: string, userId: string, input: CreateActivityInput) {
    const created = await this.db.transaction(async (tx) => {
      const [activity] = await tx
        .insert(activities)
        .values({
          orgId,
          contactId: input.contactId ?? null,
          leadId: input.leadId ?? null,
          type: input.type,
          notes: input.notes ?? null,
          dueAt: input.dueAt ?? null,
          assignedToUserId: input.assignedToUserId ?? userId,
          createdByUserId: userId,
        })
        .returning();
      if (activity) {
        const contactId = await this.resolveContactId(orgId, activity);
        await this.auditLog.record(tx, {
          orgId,
          actorUserId: userId,
          action: "created",
          entityType: "activity",
          entityId: activity.id,
          contactId,
          changes: [{ field: "type", from: null, to: activity.type }],
        });
      }
      return activity;
    });
    return created;
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateActivityInput) {
    const existing = await this.getOne(orgId, id);
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(activities)
        .set({
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
          ...(input.assignedToUserId !== undefined ? { assignedToUserId: input.assignedToUserId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(activities.id, id))
        .returning();
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, input as Record<string, unknown>);
      if (changes.length) {
        const contactId = await this.resolveContactId(orgId, existing);
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "activity",
          entityId: id,
          contactId,
          changes,
        });
      }
      return row;
    });
    return updated;
  }

  async markDone(orgId: string, id: string, actorUserId: string) {
    const existing = await this.getOne(orgId, id);
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(activities)
        .set({ doneAt: new Date(), updatedAt: new Date() })
        .where(eq(activities.id, id))
        .returning();
      const contactId = await this.resolveContactId(orgId, existing);
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "marked done",
        entityType: "activity",
        entityId: id,
        contactId,
      });
      return row;
    });
    return updated;
  }

  async markUndone(orgId: string, id: string, actorUserId: string) {
    const existing = await this.getOne(orgId, id);
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(activities)
        .set({ doneAt: null, updatedAt: new Date() })
        .where(eq(activities.id, id))
        .returning();
      const contactId = await this.resolveContactId(orgId, existing);
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "marked undone",
        entityType: "activity",
        entityId: id,
        contactId,
      });
      return row;
    });
    return updated;
  }

  async delete(orgId: string, id: string, actorUserId: string) {
    const existing = await this.getOne(orgId, id);
    await this.db.transaction(async (tx) => {
      const contactId = await this.resolveContactId(orgId, existing);
      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "deleted",
        entityType: "activity",
        entityId: id,
        contactId,
        changes: [{ field: "type", from: existing.type, to: null }],
      });
      await tx.delete(activities).where(eq(activities.id, id));
    });
    return { id };
  }

  /** S-01.7: activities with `dueAt` in the past and `doneAt` null, scoped to the requesting user. */
  async overdueForUser(orgId: string, userId: string) {
    return this.db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.orgId, orgId),
          eq(activities.assignedToUserId, userId),
          isNull(activities.doneAt),
          lt(activities.dueAt, new Date()),
        ),
      )
      .orderBy(asc(activities.dueAt));
  }
}
