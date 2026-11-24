import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { meetingAttendees, meetings, member, notifications, user } from "../../db/schema";
import { SettingsService } from "../org/settings.service";
import { MeetingReminderWorker } from "./meeting-reminder.worker";
import { EmailLogService } from "../email/email-log.service";
import { EmailService } from "../email/email.service";
import { AuditLogService } from "../audit/audit-log.service";
import { NotificationsService } from "./notifications.service";

/**
 * Requires the `db` service from docker-compose.dev.yml running locally.
 *
 * Exercises `tick(now)` directly rather than going through pg-boss's
 * cron/`onModuleInit` — `tick` takes an explicit `now` specifically so this
 * doesn't need real clock manipulation (see its own doc comment). Covers:
 * exactly-once delivery per occurrence (idempotent against a second tick
 * with the same data), declined attendees never reminded, and the
 * three-tier lead-time resolution order (user override > org default >
 * hardcoded fallback).
 */
describe("MeetingReminderWorker.tick (requires local Postgres)", () => {
  let db: Database;
  let worker: MeetingReminderWorker;
  let settingsService: SettingsService;
  const createdEmails: string[] = [];

  let orgId: string;
  let organizerUserId: string;
  let attendeeUserId: string;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    settingsService = new SettingsService(db);
    const fakeQueue = { send: async () => {}, schedule: async () => {}, work: async () => {} };
    const fakePush = { isConfigured: () => false };
    const notificationsService = new NotificationsService(db, fakePush as never, new EmailLogService(db, fakeQueue as never, new EmailService(db), new AuditLogService(db)));
    worker = new MeetingReminderWorker(fakeQueue as never, settingsService, notificationsService, db);

    const organizerEmail = `reminder-organizer-${randomUUID()}@example.com`;
    const attendeeEmail = `reminder-attendee-${randomUUID()}@example.com`;
    createdEmails.push(organizerEmail, attendeeEmail);

    const organizer = await auth.api.signUpEmail({ body: { email: organizerEmail, password: "testpassword123", name: "Reminder Organizer" } });
    organizerUserId = organizer.user.id;
    const [organizerMembership] = await db.select().from(member).where(eq(member.userId, organizer.user.id));
    orgId = organizerMembership!.organizationId;

    const attendee = await auth.api.signUpEmail({ body: { email: attendeeEmail, password: "testpassword123", name: "Reminder Attendee" } });
    attendeeUserId = attendee.user.id;
    await db.delete(member).where(eq(member.userId, attendee.user.id));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: attendee.user.id, role: "staff", createdAt: new Date() });
  });

  async function createMeeting(startAt: Date, attendeeStatus: "accepted" | "declined" | "tentative" | "invited" = "accepted") {
    const [meeting] = await db
      .insert(meetings)
      .values({
        orgId,
        title: "Reminder test meeting",
        startAt,
        endAt: new Date(startAt.getTime() + 30 * 60 * 1000),
        organizerUserId,
      })
      .returning();
    await db.insert(meetingAttendees).values({ meetingId: meeting!.id, userId: attendeeUserId, status: attendeeStatus });
    return meeting!;
  }

  it("reminds an accepted attendee once their lead-time window is reached, and not before", async () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const meeting = await createMeeting(new Date("2026-06-01T12:10:00Z")); // 10 min out
    await settingsService.set(orgId, "meeting_reminder_lead_minutes", { minutes: 15 }); // 15-min lead ⇒ due now

    await worker.tick(now);

    const [attendeeRow] = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, meeting.id));
    expect(attendeeRow?.remindedAt).not.toBeNull();

    // The worker sends the notification without waiting for it (a failed send never blocks other reminders), so wait for it here.
    await vi.waitFor(async () => {
      const notifRows = await db.select().from(notifications).where(eq(notifications.orgId, orgId));
      expect(notifRows.some((n) => n.type === "meeting_starting_soon" && n.recipientUserId === attendeeUserId)).toBe(true);
    });
  });

  it("does NOT remind before the lead-time window is reached", async () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const meeting = await createMeeting(new Date("2026-06-01T13:00:00Z")); // 60 min out
    await settingsService.set(orgId, "meeting_reminder_lead_minutes", { minutes: 15 }); // not due yet

    await worker.tick(now);

    const [attendeeRow] = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, meeting.id));
    expect(attendeeRow?.remindedAt).toBeNull();
  });

  it("never reminds a declined attendee", async () => {
    const now = new Date("2026-06-01T12:00:00Z");
    await createMeeting(new Date("2026-06-01T12:05:00Z"), "declined");
    await settingsService.set(orgId, "meeting_reminder_lead_minutes", { minutes: 15 });

    await worker.tick(now);

    const notifRows = await db.select().from(notifications).where(eq(notifications.orgId, orgId));
    expect(notifRows.some((n) => n.type === "meeting_starting_soon")).toBe(false);
  });

  it("is idempotent: a second tick for the same occurrence does not send a duplicate reminder", async () => {
    const now = new Date("2026-06-01T12:00:00Z");
    await createMeeting(new Date("2026-06-01T12:10:00Z"));
    await settingsService.set(orgId, "meeting_reminder_lead_minutes", { minutes: 15 });

    await worker.tick(now);
    await worker.tick(new Date(now.getTime() + 60 * 1000)); // one minute later, same occurrence

    // Wait for the (unawaited) send to land, then make sure there's only one.
    const reminders = async () =>
      (await db.select().from(notifications).where(eq(notifications.orgId, orgId))).filter((n) => n.type === "meeting_starting_soon" && n.recipientUserId === attendeeUserId);
    await vi.waitFor(async () => expect((await reminders()).length).toBeGreaterThan(0));
    expect(await reminders()).toHaveLength(1);
  });

  it("lead-time resolution: per-user override beats org default", async () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const meeting = await createMeeting(new Date("2026-06-01T12:20:00Z")); // 20 min out
    await settingsService.set(orgId, "meeting_reminder_lead_minutes", { minutes: 5 }); // org default: not due
    await db.update(user).set({ meetingReminderLeadMinutes: 30 }).where(eq(user.id, attendeeUserId)); // user override: due

    await worker.tick(now);

    const [attendeeRow] = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, meeting.id));
    expect(attendeeRow?.remindedAt).not.toBeNull();
  });

  it("lead-time resolution: org default beats the hardcoded fallback when no user override is set", async () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const meeting = await createMeeting(new Date("2026-06-01T12:20:00Z")); // 20 min out — fallback (15) would NOT be due, org default (25) IS
    await settingsService.set(orgId, "meeting_reminder_lead_minutes", { minutes: 25 });

    await worker.tick(now);

    const [attendeeRow] = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, meeting.id));
    expect(attendeeRow?.remindedAt).not.toBeNull();
  });

  it("falls back to the hardcoded default when neither user nor org has set a lead time", async () => {
    const now = new Date("2026-06-01T12:00:00Z");
    const meeting = await createMeeting(new Date("2026-06-01T12:10:00Z")); // 10 min out — within the 15-min hardcoded fallback

    await worker.tick(now);

    const [attendeeRow] = await db.select().from(meetingAttendees).where(eq(meetingAttendees.meetingId, meeting.id));
    expect(attendeeRow?.remindedAt).not.toBeNull();
  });
});
