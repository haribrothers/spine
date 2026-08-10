import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { createMeetingSchema, updateMeetingSchema } from "@spine/shared";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { meetings, member } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { SettingsService } from "../org/settings.service";

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
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * `from`/`to` filter by overlap with the meeting's [startAt, endAt]
   * range — used by the /meetings calendar page to fetch only the visible
   * date range. `organizerUserId` (added for S-09.12's dashboard
   * "upcoming meetings" widget) narrows to meetings a specific user
   * organizes — the dashboard route (Stage 3) decides when to pass this
   * based on the org's `dashboard_meetings_scope` setting and the
   * requester's role; this method itself has no opinion about scope.
   */
  async list(orgId: string, filters: { contactId?: string; from?: Date; to?: Date; organizerUserId?: string }) {
    const conditions = [eq(meetings.orgId, orgId)];
    if (filters.contactId) conditions.push(eq(meetings.contactId, filters.contactId));
    if (filters.from) conditions.push(gte(meetings.endAt, filters.from));
    if (filters.to) conditions.push(lte(meetings.startAt, filters.to));
    if (filters.organizerUserId) conditions.push(eq(meetings.organizerUserId, filters.organizerUserId));
    return this.db
      .select()
      .from(meetings)
      .where(and(...conditions))
      .orderBy(desc(meetings.startAt));
  }

  /**
   * S-09.12/S-10.19 (dashboard v2) — "upcoming meetings" widget. Reads
   * `dashboard_meetings_scope` and applies the org's own choice, EXCEPT
   * for Field: Field always sees own-meetings-only regardless of the
   * setting, since Field's narrower access is a hard rule elsewhere in
   * this codebase (mobile hides all financial reports, §S-11.8), not
   * something an org preference should be able to widen. This check is
   * server-side and unconditional — there is no client-side toggle that
   * could bypass it.
   */
  async upcomingForDashboard(orgId: string, userId: string, options: { withinDays?: number } = {}) {
    const withinDays = options.withinDays ?? 7;
    const from = new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + withinDays);

    const [membership] = await this.db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));

    let organizerUserId: string | undefined = userId;
    if (membership?.role !== "field") {
      const scopeSetting = await this.settingsService.get<{ scope?: "own" | "org" }>(orgId, "dashboard_meetings_scope");
      if (scopeSetting?.scope === "org") {
        organizerUserId = undefined;
      }
    }

    const rows = await this.db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.orgId, orgId),
          gte(meetings.endAt, from),
          lte(meetings.startAt, to),
          ...(organizerUserId ? [eq(meetings.organizerUserId, organizerUserId)] : []),
        ),
      )
      .orderBy(asc(meetings.startAt));

    return rows;
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
