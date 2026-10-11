import { randomUUID } from "node:crypto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { member, meetingAttendees, meetingOccurrenceExceptions, meetings, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "../notifications/notifications.service";
import { SettingsService } from "../org/settings.service";
import { EmailLogService } from "../email/email-log.service";
import { EmailService } from "../email/email.service";
import { MeetingsService } from "./meetings.service";

/**
 * Requires the `db` service from docker-compose.dev.yml running locally.
 * Focused on the read-side visibility matrix (PRD S-01.10/S-01.11) — this
 * is exactly the "silent bug" surface CLAUDE.md's testing philosophy
 * warns about: a wrong visibility filter fails silently (a user just
 * quietly sees/doesn't-see something), never with a crash. Notification
 * delivery itself is NOT exercised here — `NotificationsService` is
 * injected as-is (real object, real DB-backed listRecent/etc.), but its
 * `notify()` calls are fire-and-forget and will simply no-op against a
 * QueueService that never had `onModuleInit` run, since `notify()` itself
 * swallows errors by design (see its own doc comment). This test only
 * asserts on MeetingsService's own return values, not on notifications
 * being sent — that's notifications.service's own test's job.
 */
describe("MeetingsService visibility (requires local Postgres)", () => {
  let db: Database;
  let meetingsService: MeetingsService;
  const createdEmails: string[] = [];

  let orgId: string;
  let ownerUserId: string;
  let organizerUserId: string;
  let invitedUserId: string;
  let outsiderUserId: string;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const auditLog = new AuditLogService(db);
    const settingsService = new SettingsService(db);
    // notify() swallows failures internally, but a genuinely no-op fake
    // (rather than an empty object) keeps this test's console output free
    // of expected-but-noisy "queue.send is not a function" error logs —
    // we never assert on delivery here (see class doc comment above).
    const fakeQueue = { send: async () => {} };
    const fakePush = { isConfigured: () => false };
    const notifications = new NotificationsService(db, fakePush as never, new EmailLogService(db, fakeQueue as never, new EmailService(db), new AuditLogService(db)));
    meetingsService = new MeetingsService(db, auditLog, settingsService, notifications);

    const ownerEmail = `meetings-vis-owner-${randomUUID()}@example.com`;
    const organizerEmail = `meetings-vis-organizer-${randomUUID()}@example.com`;
    const invitedEmail = `meetings-vis-invited-${randomUUID()}@example.com`;
    const outsiderEmail = `meetings-vis-outsider-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, organizerEmail, invitedEmail, outsiderEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Vis Owner" } });
    ownerUserId = owner.user.id;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const organizer = await auth.api.signUpEmail({ body: { email: organizerEmail, password: "testpassword123", name: "Vis Organizer" } });
    organizerUserId = organizer.user.id;
    await db.delete(member).where(eq(member.userId, organizer.user.id));
    const [organizerMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: organizer.user.id, role: "staff", createdAt: new Date() })
      .returning();

    // This file predates the own/others capability split — MeetingsService's
    // update()/delete() now check meetings.edit_own/edit_others/delete_own/
    // delete_others internally (see capability.util.ts's
    // requireOwnershipCapability), so the organizer used throughout these
    // tests needs a real grant, same as any real Staff user would via the
    // Team privilege matrix. Every call below acts on the organizer's own
    // meetings, so *_own is sufficient — no test here exercises the
    // *_others path (that's meetings-ownership.integration.test.ts's job).
    const [organizerTeam] = await db.insert(teams).values({ orgId, name: "Vis Organizer Team" }).returning();
    await db.insert(teamMemberships).values({ teamId: organizerTeam!.id, memberId: organizerMember!.id });
    await db.insert(teamPrivileges).values([
      { teamId: organizerTeam!.id, capability: "meetings.edit_own", granted: true },
      { teamId: organizerTeam!.id, capability: "meetings.delete_own", granted: true },
    ]);

    const invited = await auth.api.signUpEmail({ body: { email: invitedEmail, password: "testpassword123", name: "Vis Invited" } });
    invitedUserId = invited.user.id;
    await db.delete(member).where(eq(member.userId, invited.user.id));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: invited.user.id, role: "staff", createdAt: new Date() });

    const outsider = await auth.api.signUpEmail({ body: { email: outsiderEmail, password: "testpassword123", name: "Vis Outsider" } });
    outsiderUserId = outsider.user.id;
    await db.delete(member).where(eq(member.userId, outsider.user.id));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: outsider.user.id, role: "staff", createdAt: new Date() });
  });

  async function createPrivateMeeting() {
    return meetingsService.create(orgId, organizerUserId, {
      title: "Private planning session",
      startAt: new Date(Date.now() + 60 * 60 * 1000),
      endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      attendeeUserIds: [invitedUserId],
    } as never);
  }

  async function createOrgMeeting() {
    return meetingsService.create(orgId, organizerUserId, {
      title: "All-hands",
      startAt: new Date(Date.now() + 60 * 60 * 1000),
      endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      visibility: "org",
    } as never);
  }

  async function createRecurringMeeting() {
    return meetingsService.create(orgId, organizerUserId, {
      title: "Weekly sync",
      startAt: new Date(Date.now() + 60 * 60 * 1000),
      endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      recurrence: { frequency: "weekly", end: { type: "count", count: 10 } },
      attendeeUserIds: [invitedUserId],
    } as never);
  }

  describe("list", () => {
    it("Owner sees a private meeting they didn't organize and aren't invited to", async () => {
      await createPrivateMeeting();
      const requestingUser = await meetingsService.resolveRequestingUser(orgId, ownerUserId);
      const rows = await meetingsService.list(orgId, requestingUser, {});
      expect(rows).toHaveLength(1);
    });

    it("Staff organizer sees their own private meeting", async () => {
      await createPrivateMeeting();
      const requestingUser = await meetingsService.resolveRequestingUser(orgId, organizerUserId);
      const rows = await meetingsService.list(orgId, requestingUser, {});
      expect(rows).toHaveLength(1);
    });

    it("Staff invited attendee sees a private meeting they're invited to", async () => {
      await createPrivateMeeting();
      const requestingUser = await meetingsService.resolveRequestingUser(orgId, invitedUserId);
      const rows = await meetingsService.list(orgId, requestingUser, {});
      expect(rows).toHaveLength(1);
    });

    it("Staff who is neither organizer nor invited does NOT see a private meeting", async () => {
      await createPrivateMeeting();
      const requestingUser = await meetingsService.resolveRequestingUser(orgId, outsiderUserId);
      const rows = await meetingsService.list(orgId, requestingUser, {});
      expect(rows).toHaveLength(0);
    });

    it("an org-visibility meeting is visible to everyone regardless of invite status", async () => {
      await createOrgMeeting();
      const requestingUser = await meetingsService.resolveRequestingUser(orgId, outsiderUserId);
      const rows = await meetingsService.list(orgId, requestingUser, {});
      expect(rows).toHaveLength(1);
    });
  });

  describe("getOne", () => {
    it("throws NotFoundException (not ForbiddenException) for a private meeting the requester can't see", async () => {
      const created = await createPrivateMeeting();
      const requestingUser = await meetingsService.resolveRequestingUser(orgId, outsiderUserId);
      await expect(meetingsService.getOne(orgId, created!.id, requestingUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("succeeds for an invited attendee", async () => {
      const created = await createPrivateMeeting();
      const requestingUser = await meetingsService.resolveRequestingUser(orgId, invitedUserId);
      const found = await meetingsService.getOne(orgId, created!.id, requestingUser);
      expect(found.id).toBe(created!.id);
    });
  });

  describe("create", () => {
    it("gives the organizer a synthetic, pre-accepted attendee row", async () => {
      const created = await createPrivateMeeting();
      const [organizerRow] = await db
        .select()
        .from(meetingAttendees)
        .where(eq(meetingAttendees.meetingId, created!.id));
      const organizerAttendee = (
        await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, created!.id))
      ).find((a) => a.userId === organizerUserId);
      expect(organizerAttendee?.status).toBe("accepted");
      expect(organizerAttendee?.respondedAt).not.toBeNull();
      expect(organizerRow).toBeDefined();
    });

    it("returns occurrenceExceptions as an empty array, never undefined (regression: apps/web's toCalendarEvent crashed on .map() of undefined)", async () => {
      const created = await createPrivateMeeting();
      expect(created).toHaveProperty("occurrenceExceptions");
      expect((created as unknown as { occurrenceExceptions: unknown[] }).occurrenceExceptions).toEqual([]);
    });
  });

  describe("respond", () => {
    it("first response does not throw and updates status silently", async () => {
      const created = await createPrivateMeeting();
      const updated = await meetingsService.respond(orgId, created!.id, invitedUserId, { status: "accepted" });
      expect(updated.status).toBe("accepted");
    });

    it("a non-attendee cannot respond", async () => {
      const created = await createPrivateMeeting();
      await expect(meetingsService.respond(orgId, created!.id, outsiderUserId, { status: "accepted" })).rejects.toThrow();
    });

    it("redundant same-status response is a no-op returning the existing row", async () => {
      const created = await createPrivateMeeting();
      await meetingsService.respond(orgId, created!.id, invitedUserId, { status: "accepted" });
      const second = await meetingsService.respond(orgId, created!.id, invitedUserId, { status: "accepted" });
      expect(second.status).toBe("accepted");
    });
  });

  describe("update — occurrence scope (PRD S-01.14)", () => {
    it("creates a modified exception row without touching the series row", async () => {
      const created = await createRecurringMeeting();
      const occurrenceDate = created!.startAt as Date;

      await meetingsService.update(orgId, created!.id, organizerUserId, {
        scope: "occurrence",
        occurrenceDate,
        title: "Weekly sync (rescheduled)",
      } as never);

      const [seriesRow] = await db.select().from(meetings).where(eq(meetings.id, created!.id));
      expect(seriesRow?.title).toBe("Weekly sync");

      const exceptions = await db
        .select()
        .from(meetingOccurrenceExceptions)
        .where(eq(meetingOccurrenceExceptions.meetingId, created!.id));
      expect(exceptions).toHaveLength(1);
      expect(exceptions[0]?.status).toBe("modified");
      expect(exceptions[0]?.title).toBe("Weekly sync (rescheduled)");
    });

    it("editing the same occurrence twice upserts, not duplicates", async () => {
      const created = await createRecurringMeeting();
      const occurrenceDate = created!.startAt as Date;

      await meetingsService.update(orgId, created!.id, organizerUserId, {
        scope: "occurrence",
        occurrenceDate,
        title: "First edit",
      } as never);
      await meetingsService.update(orgId, created!.id, organizerUserId, {
        scope: "occurrence",
        occurrenceDate,
        title: "Second edit",
      } as never);

      const exceptions = await db
        .select()
        .from(meetingOccurrenceExceptions)
        .where(eq(meetingOccurrenceExceptions.meetingId, created!.id));
      expect(exceptions).toHaveLength(1);
      expect(exceptions[0]?.title).toBe("Second edit");
    });

    it("rejects scope: occurrence on a non-recurring meeting", async () => {
      const created = await createPrivateMeeting();
      await expect(
        meetingsService.update(orgId, created!.id, organizerUserId, {
          scope: "occurrence",
          occurrenceDate: created!.startAt,
          title: "Nope",
        } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("delete — occurrence scope (PRD S-01.14)", () => {
    it("creates a cancelled exception row; series row and attendees untouched", async () => {
      const created = await createRecurringMeeting();
      const occurrenceDate = created!.startAt as Date;

      await meetingsService.delete(orgId, created!.id, organizerUserId, { scope: "occurrence", occurrenceDate });

      const [seriesRow] = await db.select().from(meetings).where(eq(meetings.id, created!.id));
      expect(seriesRow).toBeDefined();

      const attendeeRows = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, created!.id));
      expect(attendeeRows.length).toBeGreaterThan(0);

      const exceptions = await db
        .select()
        .from(meetingOccurrenceExceptions)
        .where(eq(meetingOccurrenceExceptions.meetingId, created!.id));
      expect(exceptions).toHaveLength(1);
      expect(exceptions[0]?.status).toBe("cancelled");
      expect(exceptions[0]?.title).toBeNull();
    });

    it("deleting the same occurrence twice is idempotent", async () => {
      const created = await createRecurringMeeting();
      const occurrenceDate = created!.startAt as Date;

      await meetingsService.delete(orgId, created!.id, organizerUserId, { scope: "occurrence", occurrenceDate });
      await meetingsService.delete(orgId, created!.id, organizerUserId, { scope: "occurrence", occurrenceDate });

      const exceptions = await db
        .select()
        .from(meetingOccurrenceExceptions)
        .where(eq(meetingOccurrenceExceptions.meetingId, created!.id));
      expect(exceptions).toHaveLength(1);
    });

    it("rejects scope: occurrence on a non-recurring meeting", async () => {
      const created = await createPrivateMeeting();
      await expect(
        meetingsService.delete(orgId, created!.id, organizerUserId, { scope: "occurrence", occurrenceDate: created!.startAt }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("update/delete — series scope (regression)", () => {
    it("update with scope omitted still mutates the series row exactly as before", async () => {
      const created = await createRecurringMeeting();
      const updated = await meetingsService.update(orgId, created!.id, organizerUserId, { title: "Renamed series" } as never);
      expect((updated as { title?: string })?.title).toBe("Renamed series");

      const exceptions = await db
        .select()
        .from(meetingOccurrenceExceptions)
        .where(eq(meetingOccurrenceExceptions.meetingId, created!.id));
      expect(exceptions).toHaveLength(0);
    });

    it("delete with scope omitted still deletes the whole series row", async () => {
      const created = await createRecurringMeeting();
      await meetingsService.delete(orgId, created!.id, organizerUserId);

      const rows = await db.select().from(meetings).where(eq(meetings.id, created!.id));
      expect(rows).toHaveLength(0);
    });

    it("a series-scoped update still returns occurrenceExceptions, including ones that already existed (regression: this response feeds straight into apps/web's meetings state and previously omitted the field, crashing toCalendarEvent)", async () => {
      const created = await createRecurringMeeting();
      const occurrenceDate = created!.startAt as Date;
      await meetingsService.update(orgId, created!.id, organizerUserId, {
        scope: "occurrence",
        occurrenceDate,
        title: "Occurrence override",
      } as never);

      const updated = await meetingsService.update(orgId, created!.id, organizerUserId, { title: "Renamed series" } as never);
      const withExceptions = updated as unknown as { occurrenceExceptions: { title: string | null }[] };
      expect(withExceptions.occurrenceExceptions).toHaveLength(1);
      expect(withExceptions.occurrenceExceptions[0]?.title).toBe("Occurrence override");
    });
  });

  describe("list/getOne — occurrenceExceptions passthrough", () => {
    it("a meeting with an exception returns it nested on the row", async () => {
      const created = await createRecurringMeeting();
      const occurrenceDate = created!.startAt as Date;
      await meetingsService.update(orgId, created!.id, organizerUserId, {
        scope: "occurrence",
        occurrenceDate,
        title: "Overridden",
      } as never);

      const requestingUser = await meetingsService.resolveRequestingUser(orgId, organizerUserId);
      const found = await meetingsService.getOne(orgId, created!.id, requestingUser);
      expect(found.occurrenceExceptions).toHaveLength(1);
      expect(found.occurrenceExceptions[0]?.title).toBe("Overridden");
    });

    it("a meeting without exceptions returns an empty array, not null/undefined", async () => {
      const created = await createPrivateMeeting();
      const requestingUser = await meetingsService.resolveRequestingUser(orgId, organizerUserId);
      const found = await meetingsService.getOne(orgId, created!.id, requestingUser);
      expect(found.occurrenceExceptions).toEqual([]);
    });
  });
});
