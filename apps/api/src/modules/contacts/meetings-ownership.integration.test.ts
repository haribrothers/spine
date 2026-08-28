import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Capability } from "@spine/shared";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { meetings, member, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { MeetingsService } from "./meetings.service";
import { AuditLogService } from "../audit/audit-log.service";
import { SettingsService } from "../org/settings.service";
import { NotificationsService } from "../notifications/notifications.service";
import { QueueService } from "../queue/queue.service";
import { PushService } from "../notifications/push.service";

/**
 * Regression coverage for the own/others capability split extended to
 * Meetings — `meetings.manage` is replaced by `meetings.edit_own`/
 * `edit_others`/`delete_own`/`delete_others`, keyed on `organizerUserId`
 * (meetings have no separate `createdByUserId`; the organizer set at
 * create time is the ownership signal, same "assigned person, not a
 * literal creator" pattern already used for leads' `ownerUserId`).
 *
 * This file does NOT touch the separate, unconditional read-visibility
 * system (private/org + invite list) — that's tested in
 * meetings.service.integration.test.ts and is untouched by this change.
 *
 * QueueService/PushService are constructed directly without their
 * lifecycle hooks — none of create/update/delete exercise notification
 * delivery in a way that requires a real queue connection for this test's
 * assertions (any enqueue failure is caught internally by
 * NotificationsService, matching the graceful-degradation pattern already
 * verified for QuotesService.send in quotes-ownership.integration.test.ts).
 *
 * Requires the `db` service from docker-compose.dev.yml running locally.
 */
describe("Meetings ownership split (requires local Postgres)", () => {
  let db: Database;
  const createdEmails: string[] = [];

  let orgId: string;
  let creatorUserId: string;
  let creatorMemberId: string;
  let otherUserId: string;
  let otherMemberId: string;
  let meetingsService: MeetingsService;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  async function grantTeam(memberId: string, grants: Partial<Record<Capability, boolean>>) {
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    const rows = Object.entries(grants).map(([capability, granted]) => ({
      teamId: team!.id,
      capability: capability as Capability,
      granted: granted ?? false,
    }));
    if (rows.length) {
      await db.insert(teamPrivileges).values(rows);
    }
    return team!.id;
  }

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const queue = new QueueService(db);
    const notifications = new NotificationsService(db, queue, new PushService(db));
    meetingsService = new MeetingsService(db, new AuditLogService(db), new SettingsService(db), notifications);

    const ownerEmail = `meeting-owner-${randomUUID()}@example.com`;
    const creatorEmail = `meeting-creator-${randomUUID()}@example.com`;
    const otherEmail = `meeting-other-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, creatorEmail, otherEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Ownership Owner" } });
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const creator = await auth.api.signUpEmail({ body: { email: creatorEmail, password: "testpassword123", name: "Ownership Creator" } });
    creatorUserId = creator.user.id;
    await db.delete(member).where(eq(member.userId, creator.user.id));
    const [creatorMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: creator.user.id, role: "staff", createdAt: new Date() })
      .returning();
    creatorMemberId = creatorMember!.id;

    const other = await auth.api.signUpEmail({ body: { email: otherEmail, password: "testpassword123", name: "Ownership Other" } });
    otherUserId = other.user.id;
    await db.delete(member).where(eq(member.userId, other.user.id));
    const [otherMember] = await db
      .insert(member)
      .values({ id: randomUUID(), organizationId: orgId, userId: other.user.id, role: "staff", createdAt: new Date() })
      .returning();
    otherMemberId = otherMember!.id;
  });

  function meetingInput(title: string) {
    const startAt = new Date(Date.now() + 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    return { title, startAt, endAt, visibility: "org" as const };
  }

  it("organizer with only edit_own can update their own meeting but not another user's", async () => {
    await grantTeam(creatorMemberId, { "meetings.edit_own": true });
    const created = await meetingsService.create(orgId, creatorUserId, meetingInput("Own Meeting"));

    await expect(meetingsService.update(orgId, created!.id, creatorUserId, { title: "Renamed by organizer" })).resolves.toBeDefined();
    await expect(meetingsService.update(orgId, created!.id, otherUserId, { title: "Renamed by other" })).rejects.toThrow(/missing capability/i);
  });

  it("edit_others lets a different staff user edit a meeting they didn't organize", async () => {
    await grantTeam(creatorMemberId, { "meetings.edit_own": true });
    const created = await meetingsService.create(orgId, creatorUserId, meetingInput("Organizer's Meeting"));

    await grantTeam(otherMemberId, { "meetings.edit_others": true });
    await expect(meetingsService.update(orgId, created!.id, otherUserId, { title: "Edited by other" })).resolves.toBeDefined();
  });

  it("delete_own vs delete_others are independent of edit_own/edit_others", async () => {
    await grantTeam(creatorMemberId, { "meetings.edit_own": true });
    const created = await meetingsService.create(orgId, creatorUserId, meetingInput("To Delete"));

    await grantTeam(otherMemberId, { "meetings.edit_others": true });
    await expect(meetingsService.delete(orgId, created!.id, otherUserId)).rejects.toThrow(/missing capability/i);

    await grantTeam(otherMemberId, { "meetings.delete_others": true });
    await expect(meetingsService.delete(orgId, created!.id, otherUserId)).resolves.toBeDefined();
  });

  it("a legacy meeting with no organizerUserId can only be touched via the _others capability, never _own", async () => {
    const startAt = new Date(Date.now() + 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const [legacyMeeting] = await db
      .insert(meetings)
      .values({ orgId, title: "Legacy Unowned Meeting", startAt, endAt, visibility: "org", organizerUserId: null })
      .returning();

    await grantTeam(creatorMemberId, { "meetings.edit_own": true });
    await expect(meetingsService.update(orgId, legacyMeeting!.id, creatorUserId, { title: "Attempted edit" })).rejects.toThrow(/missing capability/i);

    await grantTeam(otherMemberId, { "meetings.edit_others": true });
    await expect(meetingsService.update(orgId, legacyMeeting!.id, otherUserId, { title: "Successful edit" })).resolves.toBeDefined();
  });

  it("Owner bypasses the ownership check entirely, regardless of Team grants", async () => {
    const created = await meetingsService.create(orgId, creatorUserId, meetingInput("Any Meeting"));
    const [ownerMembership] = await db.select().from(member).where(and(eq(member.organizationId, orgId), eq(member.role, "owner")));
    await expect(meetingsService.update(orgId, created!.id, ownerMembership!.userId, { title: "Edited by owner" })).resolves.toBeDefined();
  });
});
