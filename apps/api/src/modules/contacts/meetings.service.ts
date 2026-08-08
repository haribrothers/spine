import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createMeetingSchema, updateMeetingSchema } from "@spine/shared";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { meetings } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;

/**
 * PRD S-01.9 — schedule and view meetings with contacts on a calendar.
 * Meetings CRUD, org-scoped, optionally linked to a contact (`contactId`
 * nullable — an internal meeting has no contact). Unlike `activities`,
 * there's no "mark done" concept here — a meeting is a scheduled time
 * range, not a to-do.
 */
@Injectable()
export class MeetingsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
  ) {}

  /** `from`/`to` filter by overlap with the meeting's [startAt, endAt] range — used by the /meetings calendar page to fetch only the visible date range. */
  async list(orgId: string, filters: { contactId?: string; from?: Date; to?: Date }) {
    const conditions = [eq(meetings.orgId, orgId)];
    if (filters.contactId) conditions.push(eq(meetings.contactId, filters.contactId));
    if (filters.from) conditions.push(gte(meetings.endAt, filters.from));
    if (filters.to) conditions.push(lte(meetings.startAt, filters.to));
    return this.db
      .select()
      .from(meetings)
      .where(and(...conditions))
      .orderBy(desc(meetings.startAt));
  }

  async getOne(orgId: string, id: string) {
    const [meeting] = await this.db
      .select()
      .from(meetings)
      .where(and(eq(meetings.orgId, orgId), eq(meetings.id, id)));
    if (!meeting) {
      throw new NotFoundException("Meeting not found");
    }
    return meeting;
  }

  async create(orgId: string, userId: string, input: CreateMeetingInput) {
    const created = await this.db.transaction(async (tx) => {
      const [meeting] = await tx
        .insert(meetings)
        .values({
          orgId,
          contactId: input.contactId ?? null,
          title: input.title,
          startAt: input.startAt,
          endAt: input.endAt,
          allDay: input.allDay ?? false,
          color: input.color ?? "blue",
          description: input.description ?? null,
          location: input.location ?? null,
          recurrence: input.recurrence
            ? { ...input.recurrence, end: input.recurrence.end.type === "date" ? { type: "date" as const, date: input.recurrence.end.date.toISOString() } : input.recurrence.end }
            : null,
          organizerUserId: userId,
        })
        .returning();
      if (meeting) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId: userId,
          action: "created",
          entityType: "meeting",
          entityId: meeting.id,
          contactId: meeting.contactId,
          changes: [{ field: "title", from: null, to: meeting.title }],
        });
      }
      return meeting;
    });
    return created;
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateMeetingInput) {
    const existing = await this.getOne(orgId, id);
    const updated = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(meetings)
        .set({
          ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
          ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
          ...(input.allDay !== undefined ? { allDay: input.allDay } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          ...(input.recurrence !== undefined
            ? {
                recurrence: input.recurrence
                  ? { ...input.recurrence, end: input.recurrence.end.type === "date" ? { type: "date" as const, date: input.recurrence.end.date.toISOString() } : input.recurrence.end }
                  : null,
              }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(meetings.id, id))
        .returning();
      const changes = AuditLogService.diffFields(existing as unknown as Record<string, unknown>, input as Record<string, unknown>);
      if (changes.length) {
        await this.auditLog.record(tx, {
          orgId,
          actorUserId,
          action: "updated",
          entityType: "meeting",
          entityId: id,
          contactId: row?.contactId ?? existing.contactId,
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
        entityType: "meeting",
        entityId: id,
        contactId: existing.contactId,
        changes: [{ field: "title", from: existing.title, to: null }],
      });
      await tx.delete(meetings).where(eq(meetings.id, id));
    });
    return { id };
  }
}
