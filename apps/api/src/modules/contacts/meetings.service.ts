import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  createMeetingSchema,
  deleteMeetingScopeSchema,
  respondToMeetingSchema,
  updateMeetingSchema,
} from "@spine/shared";
import { and, asc, desc, eq, exists, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE } from "../../db/db.module";
import type { Database } from "../../db/client";
import { meetingAttendees, meetingOccurrenceExceptions, meetings, member, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { requireOwnershipCapability } from "../../auth/capability.util";
import { NotificationsService } from "../notifications/notifications.service";
import { SettingsService } from "../org/settings.service";

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type RespondToMeetingInput = z.infer<typeof respondToMeetingSchema>;
export type DeleteMeetingScopeInput = z.infer<typeof deleteMeetingScopeSchema>;

/** Resolved once per request from `member`, never trusted from the client. */
export interface RequestingUser {
  userId: string;
  role: string;
}

/**
 * PRD S-01.9 — schedule and view meetings with contacts on a calendar.
 * Meetings CRUD, org-scoped, optionally linked to a contact (`contactId`
 * nullable — an internal meeting has no contact). Unlike `activities`,
 * there's no "mark done" concept here — a meeting is a scheduled time
 * range, not a to-do.
 *
 * PRD S-01.10/S-01.11/S-01.12 — every meeting also has a `visibility`
 * (`private`|`org`) and an invite list (`meetingAttendees`). Read access
 * (`list`/`getOne`/`upcomingForDashboard`) is enforced here, independent of
 * the `meetings.manage` capability that gates create/update/delete (see
 * CLAUDE.md's permission-model section): Owner always sees everything;
 * Staff/Field only see `org`-visibility meetings, or `private` ones they
 * organize or are invited to. The organizer always gets a synthetic
 * `meetingAttendees` row (`status: "accepted"`) at creation time so
 * reminder/response logic never has to special-case "is this the
 * organizer" anywhere else in this service or the reminder worker.
 */
@Injectable()
export class MeetingsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly auditLog: AuditLogService,
    private readonly settingsService: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Looks up the caller's org role — Owner bypasses every visibility check below; Staff/Field don't. */
  async resolveRequestingUser(orgId: string, userId: string): Promise<RequestingUser> {
    const [membership] = await this.db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)));
    return { userId, role: membership?.role ?? "staff" };
  }

  /**
   * `undefined` for an Owner (no filter — sees everything, per §2.1's
   * blanket-access rule). Otherwise: visible if the meeting is `org`-wide,
   * the requester organizes it, or the requester has a `meetingAttendees`
   * row for it (accepted, declined, tentative, or still just invited — an
   * invite itself grants read access, per S-01.10).
   */
  private visibilityCondition(requestingUser: RequestingUser) {
    if (requestingUser.role === "owner") return undefined;
    return or(
      eq(meetings.visibility, "org"),
      eq(meetings.organizerUserId, requestingUser.userId),
      exists(
        this.db
          .select({ one: sql`1` })
          .from(meetingAttendees)
          .where(and(eq(meetingAttendees.meetingId, meetings.id), eq(meetingAttendees.userId, requestingUser.userId))),
      ),
    );
  }

  /**
   * `from`/`to` filter by overlap with the meeting's [startAt, endAt]
   * range — used by the /meetings calendar page to fetch only the visible
   * date range. `organizerUserId` (added for S-09.12's dashboard
   * "upcoming meetings" widget) narrows to meetings a specific user
   * organizes — the dashboard route decides when to pass this based on the
   * org's `dashboard_meetings_scope` setting and the requester's role;
   * this method itself has no opinion about scope.
   */
  async list(
    orgId: string,
    requestingUser: RequestingUser,
    filters: { contactId?: string; from?: Date; to?: Date; organizerUserId?: string },
  ) {
    const conditions = [eq(meetings.orgId, orgId)];
    if (filters.contactId) conditions.push(eq(meetings.contactId, filters.contactId));
    if (filters.from) conditions.push(gte(meetings.endAt, filters.from));
    if (filters.to) conditions.push(lte(meetings.startAt, filters.to));
    if (filters.organizerUserId) conditions.push(eq(meetings.organizerUserId, filters.organizerUserId));
    const visibility = this.visibilityCondition(requestingUser);
    if (visibility) conditions.push(visibility);
    const rows = await this.db
      .select()
      .from(meetings)
      .where(and(...conditions))
      .orderBy(desc(meetings.startAt));
    return this.withOccurrenceExceptions(rows);
  }

  /**
   * PRD S-01.14 — batch-fetches `meeting_occurrence_exceptions` for a set of
   * meetings and nests them onto each row as `occurrenceExceptions` (always
   * an array, never null/undefined, even when empty). Exceptions carry no
   * visibility of their own — they ride along with whatever meeting row
   * already passed the caller's visibility filter, so no extra check is
   * needed here. Recurrence expansion itself stays a client-side pure
   * function (calendar-utils.ts); this just ships the raw exception rows
   * for that function to consult, same pattern as `meetings.recurrence`
   * itself being stored as-authored rather than expanded server-side.
   */
  private async withOccurrenceExceptions<T extends { id: string }>(rows: T[]) {
    if (!rows.length) return rows.map((row) => ({ ...row, occurrenceExceptions: [] }));
    const meetingIds = rows.map((row) => row.id);
    const exceptionRows = await this.db
      .select()
      .from(meetingOccurrenceExceptions)
      .where(inArray(meetingOccurrenceExceptions.meetingId, meetingIds));
    const byMeetingId = new Map<string, typeof exceptionRows>();
    for (const exception of exceptionRows) {
      const bucket = byMeetingId.get(exception.meetingId);
      if (bucket) bucket.push(exception);
      else byMeetingId.set(exception.meetingId, [exception]);
    }
    return rows.map((row) => ({ ...row, occurrenceExceptions: byMeetingId.get(row.id) ?? [] }));
  }

  /**
   * S-09.12/S-10.19 (dashboard v2) — "upcoming meetings" widget. Reads
   * `dashboard_meetings_scope` and applies the org's own choice, EXCEPT
   * for Field: Field always sees own-meetings-only regardless of the
   * setting, since Field's narrower access is a hard rule elsewhere in
   * this codebase (mobile hides all financial reports, §S-11.8), not
   * something an org preference should be able to widen. This check is
   * server-side and unconditional — there is no client-side toggle that
   * could bypass it. Visibility is enforced on top of this scope logic —
   * previously this method had no visibility check at all, so a Staff
   * member's dashboard widget could surface a private meeting they weren't
   * invited to; that gap is closed here, not just for `list`/`getOne`.
   */
  /**
   * `attending` (US-MOB-03) — "my meetings" for the field app: ones I
   * organise or am invited to and haven't declined, whatever the
   * dashboard's own/org scope setting says.
   */
  async upcomingForDashboard(orgId: string, userId: string, options: { withinDays?: number; from?: Date; attending?: boolean } = {}) {
    const withinDays = options.withinDays ?? 7;
    // US-NTF-13: the daily digest asks "from the moment it runs".
    const from = options.from ? new Date(options.from) : new Date();
    const to = new Date(from);
    to.setDate(to.getDate() + withinDays);

    const requestingUser = await this.resolveRequestingUser(orgId, userId);

    let organizerUserId: string | undefined = userId;
    if (requestingUser.role !== "field") {
      const scopeSetting = await this.settingsService.get<{ scope?: "own" | "org" }>(orgId, "dashboard_meetings_scope");
      if (scopeSetting?.scope === "org") {
        organizerUserId = undefined;
      }
    }

    const visibility = this.visibilityCondition(requestingUser);
    const rows = await this.db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.orgId, orgId),
          gte(meetings.endAt, from),
          lte(meetings.startAt, to),
          ...(options.attending
            ? [
                or(
                  eq(meetings.organizerUserId, userId),
                  inArray(
                    meetings.id,
                    this.db
                      .select({ id: meetingAttendees.meetingId })
                      .from(meetingAttendees)
                      .where(and(eq(meetingAttendees.userId, userId), ne(meetingAttendees.status, "declined"))),
                  ),
                ),
              ]
            : organizerUserId
              ? [eq(meetings.organizerUserId, organizerUserId)]
              : []),
          ...(visibility ? [visibility] : []),
        ),
      )
      .orderBy(asc(meetings.startAt));

    return this.withOccurrenceExceptions(rows);
  }

  async getOne(orgId: string, id: string, requestingUser: RequestingUser) {
    const visibility = this.visibilityCondition(requestingUser);
    const [meeting] = await this.db
      .select()
      .from(meetings)
      .where(and(eq(meetings.orgId, orgId), eq(meetings.id, id), ...(visibility ? [visibility] : [])));
    if (!meeting) {
      // Never ForbiddenException here — a private meeting outside the
      // caller's visibility must not be distinguishable from one that
      // simply doesn't exist (PRD S-01.10: "must not be retrievable via
      // the API at all").
      throw new NotFoundException("Meeting not found");
    }
    const [withExceptions] = await this.withOccurrenceExceptions([meeting]);
    return withExceptions!;
  }

  /** Same visibility gate as `getOne` — an attendee list is itself meeting detail. */
  async listAttendees(orgId: string, id: string, requestingUser: RequestingUser) {
    await this.getOne(orgId, id, requestingUser);
    return this.db
      .select({
        id: meetingAttendees.id,
        userId: meetingAttendees.userId,
        status: meetingAttendees.status,
        invitedAt: meetingAttendees.invitedAt,
        respondedAt: meetingAttendees.respondedAt,
        name: user.name,
        email: user.email,
      })
      .from(meetingAttendees)
      .leftJoin(user, eq(meetingAttendees.userId, user.id))
      .where(eq(meetingAttendees.meetingId, id));
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
          visibility: input.visibility ?? "private",
        })
        .returning();
      if (!meeting) return meeting;

      // The organizer always gets a synthetic, pre-accepted attendee row —
      // see this service's class-level comment for why (uniform
      // reminder/response handling, no special-casing elsewhere).
      const attendeeUserIds = (input.attendeeUserIds ?? []).filter((id) => id !== userId);
      await tx.insert(meetingAttendees).values([
        { meetingId: meeting.id, userId, status: "accepted" as const, respondedAt: new Date() },
        ...attendeeUserIds.map((invitedUserId) => ({ meetingId: meeting.id, userId: invitedUserId, status: "invited" as const })),
      ]);

      await this.auditLog.record(tx, {
        orgId,
        actorUserId: userId,
        action: "created",
        entityType: "meeting",
        entityId: meeting.id,
        contactId: meeting.contactId,
        changes: [{ field: "title", from: null, to: meeting.title }],
      });

      return { meeting, invitedUserIds: attendeeUserIds };
    });

    if (created?.meeting && created.invitedUserIds.length) {
      this.notifyInvited(orgId, created.meeting.id, created.meeting.title, created.invitedUserIds);
    }
    if (!created?.meeting) return created?.meeting;
    // A brand-new meeting can't have any occurrence exceptions yet, but the
    // response shape must still match every other meeting-returning
    // endpoint (list/getOne/update) — omitting the field here is exactly
    // what caused apps/web's toCalendarEvent to crash on `.map()` of
    // undefined the moment this row landed in client state.
    return { ...created.meeting, occurrenceExceptions: [] };
  }

  async update(orgId: string, id: string, actorUserId: string, input: UpdateMeetingInput) {
    // Bypass visibility for the pre-fetch here — only meetings.edit_own/
    // edit_others holders reach this method at all (checked immediately
    // below via requireOwnershipCapability, once the record is loaded),
    // and the update itself must still target the right org-scoped row.
    const existing = await this.getOne(orgId, id, { userId: actorUserId, role: "owner" });
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.organizerUserId, {
      own: "meetings.edit_own",
      others: "meetings.edit_others",
    });

    if (input.scope === "occurrence") {
      return this.updateOccurrenceException(orgId, existing, actorUserId, input);
    }

    const result = await this.db.transaction(async (tx) => {
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
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          updatedAt: new Date(),
        })
        .where(eq(meetings.id, id))
        .returning();

      let added: string[] = [];
      let removed: string[] = [];
      if (input.attendeeUserIds !== undefined) {
        const existingRows = await tx
          .select({ userId: meetingAttendees.userId })
          .from(meetingAttendees)
          .where(eq(meetingAttendees.meetingId, id));
        const existingUserIds = new Set(existingRows.map((r) => r.userId).filter((id): id is string => id !== null));
        const organizerId = existing.organizerUserId;
        const desired = new Set(input.attendeeUserIds.filter((uid) => uid !== organizerId));

        added = [...desired].filter((uid) => !existingUserIds.has(uid));
        removed = [...existingUserIds].filter((uid) => !desired.has(uid) && uid !== organizerId);

        if (added.length) {
          await tx.insert(meetingAttendees).values(added.map((invitedUserId) => ({ meetingId: id, userId: invitedUserId, status: "invited" as const })));
        }
        if (removed.length) {
          await tx.delete(meetingAttendees).where(and(eq(meetingAttendees.meetingId, id), inArray(meetingAttendees.userId, removed)));
        }
      }

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
      return { row, added, removed };
    });

    if (result.row) {
      if (result.added.length) this.notifyInvited(orgId, id, result.row.title, result.added);
      if (result.removed.length) this.notifyRemoved(orgId, id, result.row.title, result.removed);
    }
    if (!result.row) return result.row;
    // A series-scoped edit doesn't touch meeting_occurrence_exceptions, but
    // any that already existed (from a prior "this event" edit) must still
    // be reported — this response feeds straight back into apps/web's
    // meetings state, same as create()'s return above.
    const [withExceptions] = await this.withOccurrenceExceptions([result.row]);
    return withExceptions;
  }

  /**
   * PRD S-01.14 — "This event" scope. Upserts a `modified` exception row
   * keyed on `occurrenceDate`, leaving the series row untouched. Each save
   * fully re-specifies the override set from `input` (no partial-merge with
   * a previously-saved exception), matching how the series `update()` path
   * above already treats "field present in input" vs "field omitted."
   * Attendees/visibility are intentionally never touched here — they stay
   * series-level only, and the schema layer (`updateMeetingSchema`) already
   * rejects `attendeeUserIds` alongside `scope: "occurrence"` before this
   * method is ever reached, but `existing.recurrence` is re-checked here as
   * a defensive guard, since this method is a private/internal seam a future
   * caller could still hit without going through the DTO validation.
   */
  private async updateOccurrenceException(
    orgId: string,
    existing: Awaited<ReturnType<typeof this.getOne>>,
    actorUserId: string,
    input: UpdateMeetingInput,
  ) {
    if (!existing.recurrence) {
      throw new BadRequestException("Cannot scope an update to a single occurrence: this meeting is not recurring");
    }
    if (!input.occurrenceDate) {
      throw new BadRequestException("occurrenceDate is required when scope is \"occurrence\"");
    }

    const row = await this.db.transaction(async (tx) => {
      const [exception] = await tx
        .insert(meetingOccurrenceExceptions)
        .values({
          meetingId: existing.id,
          occurrenceDate: input.occurrenceDate!,
          status: "modified",
          startAt: input.startAt ?? null,
          endAt: input.endAt ?? null,
          title: input.title ?? null,
          location: input.location ?? null,
          description: input.description ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [meetingOccurrenceExceptions.meetingId, meetingOccurrenceExceptions.occurrenceDate],
          set: {
            status: "modified",
            startAt: input.startAt ?? null,
            endAt: input.endAt ?? null,
            title: input.title ?? null,
            location: input.location ?? null,
            description: input.description ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "updated",
        entityType: "meeting",
        entityId: existing.id,
        contactId: existing.contactId,
        changes: [{ field: "occurrence", from: input.occurrenceDate!.toISOString(), to: "modified" }],
      });

      return exception;
    });

    return row;
  }

  async delete(orgId: string, id: string, actorUserId: string, scope: DeleteMeetingScopeInput = {}) {
    const existing = await this.getOne(orgId, id, { userId: actorUserId, role: "owner" });
    await requireOwnershipCapability(this.db, { orgId, userId: actorUserId }, existing.organizerUserId, {
      own: "meetings.delete_own",
      others: "meetings.delete_others",
    });

    if (scope.scope === "occurrence") {
      return this.deleteOccurrenceException(orgId, existing, actorUserId, scope);
    }

    const attendeeRows = await this.db
      .select({ userId: meetingAttendees.userId })
      .from(meetingAttendees)
      .where(eq(meetingAttendees.meetingId, id));
    const attendeeUserIds = attendeeRows.map((r) => r.userId).filter((uid): uid is string => uid !== null && uid !== existing.organizerUserId);

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

    if (attendeeUserIds.length) {
      void this.notifications.notify(orgId, {
        subject: `Meeting cancelled: ${existing.title}`,
        text: `"${existing.title}" was cancelled.`,
        recipientUserIds: attendeeUserIds,
        inApp: {
          type: "meeting_cancelled",
          message: `"${existing.title}" was cancelled.`,
          link: `/meetings?id=${id}`,
        },
      });
    }
    return { id };
  }

  /**
   * PRD S-01.14 — "This event" delete scope. Upserts a `cancelled` exception
   * row (all override columns null — nothing to override, it just shouldn't
   * render) rather than deleting anything; the series row and its attendees
   * are untouched. Notifies attendees the same way a full-series delete
   * does, scoped to the one occurrence, so nobody has to notice a gap on
   * their calendar themselves.
   */
  private async deleteOccurrenceException(
    orgId: string,
    existing: Awaited<ReturnType<typeof this.getOne>>,
    actorUserId: string,
    scope: DeleteMeetingScopeInput,
  ) {
    if (!existing.recurrence) {
      throw new BadRequestException("Cannot scope a delete to a single occurrence: this meeting is not recurring");
    }
    if (!scope.occurrenceDate) {
      throw new BadRequestException("occurrenceDate is required when scope is \"occurrence\"");
    }
    const occurrenceDate = scope.occurrenceDate;

    const attendeeRows = await this.db
      .select({ userId: meetingAttendees.userId })
      .from(meetingAttendees)
      .where(eq(meetingAttendees.meetingId, existing.id));
    const attendeeUserIds = attendeeRows.map((r) => r.userId).filter((uid): uid is string => uid !== null && uid !== existing.organizerUserId);

    await this.db.transaction(async (tx) => {
      await tx
        .insert(meetingOccurrenceExceptions)
        .values({
          meetingId: existing.id,
          occurrenceDate,
          status: "cancelled",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [meetingOccurrenceExceptions.meetingId, meetingOccurrenceExceptions.occurrenceDate],
          set: {
            status: "cancelled",
            startAt: null,
            endAt: null,
            title: null,
            location: null,
            description: null,
            updatedAt: new Date(),
          },
        });

      await this.auditLog.record(tx, {
        orgId,
        actorUserId,
        action: "updated",
        entityType: "meeting",
        entityId: existing.id,
        contactId: existing.contactId,
        changes: [{ field: "occurrence", from: occurrenceDate.toISOString(), to: "cancelled" }],
      });
    });

    if (attendeeUserIds.length) {
      const occurrenceDateLabel = occurrenceDate.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      void this.notifications.notify(orgId, {
        subject: `Meeting occurrence cancelled: ${existing.title}`,
        text: `One occurrence of "${existing.title}" on ${occurrenceDateLabel} was cancelled. The rest of the series is unaffected.`,
        recipientUserIds: attendeeUserIds,
        inApp: {
          type: "meeting_cancelled",
          message: `One occurrence of "${existing.title}" on ${occurrenceDateLabel} was cancelled.`,
          link: `/meetings?id=${existing.id}`,
        },
      });
    }

    return { id: existing.id, occurrenceDate, status: "cancelled" as const };
  }

  /**
   * PRD S-01.12 — self-service accept/decline/tentative, no `meetings.manage`
   * required, only that the caller has an attendee row for this meeting.
   * The first response to a fresh invite never notifies the organizer
   * (S-10.20's `meeting_invited` already covered that moment); a change
   * AFTER an initial reply does, and only the organizer is notified. A
   * redundant same-status response is a no-op (no notify, no timestamp churn).
   */
  async respond(orgId: string, meetingId: string, userId: string, input: RespondToMeetingInput) {
    const meeting = await this.getOne(orgId, meetingId, { userId, role: "owner" });
    const [attendee] = await this.db
      .select()
      .from(meetingAttendees)
      .where(and(eq(meetingAttendees.meetingId, meetingId), eq(meetingAttendees.userId, userId)));
    if (!attendee) {
      throw new ForbiddenException("You are not invited to this meeting");
    }
    if (attendee.status === input.status) {
      return attendee;
    }

    const isFirstResponse = attendee.respondedAt === null;
    const [updated] = await this.db
      .update(meetingAttendees)
      .set({ status: input.status, respondedAt: new Date() })
      .where(eq(meetingAttendees.id, attendee.id))
      .returning();

    if (!isFirstResponse && meeting.organizerUserId && meeting.organizerUserId !== userId) {
      const [responder] = await this.db.select({ name: user.name }).from(user).where(eq(user.id, userId));
      void this.notifications.notify(orgId, {
        subject: `${responder?.name ?? "Someone"} changed their response to "${meeting.title}"`,
        text: `${responder?.name ?? "Someone"} is now "${input.status}" for "${meeting.title}".`,
        recipientUserIds: [meeting.organizerUserId],
        inApp: {
          type: "meeting_response_changed",
          message: `${responder?.name ?? "Someone"} is now "${input.status}" for "${meeting.title}".`,
          link: `/meetings?id=${meetingId}`,
        },
      });
    }

    return updated!;
  }

  private notifyInvited(orgId: string, meetingId: string, title: string, invitedUserIds: string[]) {
    void this.notifications.notify(orgId, {
      subject: `You've been invited: ${title}`,
      text: `You've been invited to "${title}".`,
      recipientUserIds: invitedUserIds,
      inApp: {
        type: "meeting_invited",
        message: `You've been invited to "${title}".`,
        link: `/meetings?id=${meetingId}`,
      },
    });
  }

  private notifyRemoved(orgId: string, meetingId: string, title: string, removedUserIds: string[]) {
    void this.notifications.notify(orgId, {
      subject: `You've been removed from a meeting: ${title}`,
      text: `You're no longer invited to "${title}".`,
      recipientUserIds: removedUserIds,
      inApp: {
        type: "meeting_removed",
        message: `You're no longer invited to "${title}".`,
        link: `/meetings?id=${meetingId}`,
      },
    });
  }
}
