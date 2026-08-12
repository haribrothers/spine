import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth } from "../../auth/auth";
import { createDb, type Database } from "../../db/client";
import { member, notifications, user } from "../../db/schema";
import { NotificationsService } from "./notifications.service";

/**
 * Requires the `db` service from docker-compose.dev.yml running locally.
 *
 * PRD S-10.20 added `recipientUserIds` to `notify()` alongside the
 * existing `recipientRoles`. The specific bug this guards against: an
 * Owner who is NOT named in `recipientUserIds` must NOT receive a
 * notification meant for one specific Staff member — a naive
 * `roles ?? ["owner"]` fallback applied unconditionally would silently
 * over-notify every Owner on every targeted notification. Verified here by
 * inspecting the persisted `notifications` rows (the in-app channel) after
 * each call, since that's a reliable, DB-verifiable signal of exactly who
 * was targeted, independent of the (unconfigured-in-tests) email/push
 * channels.
 */
describe("NotificationsService recipient targeting (requires local Postgres)", () => {
  let db: Database;
  let notificationsService: NotificationsService;
  const createdEmails: string[] = [];

  let orgId: string;
  let ownerUserId: string;
  let staffAUserId: string;
  let staffBUserId: string;

  afterAll(async () => {
    if (createdEmails.length === 0) return;
    await db.delete(user).where(inArray(user.email, createdEmails));
  });

  beforeEach(async () => {
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const fakeQueue = { send: async () => {} };
    const fakePush = { isConfigured: () => false };
    notificationsService = new NotificationsService(db, fakeQueue as never, fakePush as never);

    const ownerEmail = `notify-target-owner-${randomUUID()}@example.com`;
    const staffAEmail = `notify-target-staff-a-${randomUUID()}@example.com`;
    const staffBEmail = `notify-target-staff-b-${randomUUID()}@example.com`;
    createdEmails.push(ownerEmail, staffAEmail, staffBEmail);

    const owner = await auth.api.signUpEmail({ body: { email: ownerEmail, password: "testpassword123", name: "Target Owner" } });
    ownerUserId = owner.user.id;
    const [ownerMembership] = await db.select().from(member).where(eq(member.userId, owner.user.id));
    orgId = ownerMembership!.organizationId;

    const staffA = await auth.api.signUpEmail({ body: { email: staffAEmail, password: "testpassword123", name: "Target Staff A" } });
    staffAUserId = staffA.user.id;
    await db.delete(member).where(eq(member.userId, staffA.user.id));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staffA.user.id, role: "staff", createdAt: new Date() });

    const staffB = await auth.api.signUpEmail({ body: { email: staffBEmail, password: "testpassword123", name: "Target Staff B" } });
    staffBUserId = staffB.user.id;
    await db.delete(member).where(eq(member.userId, staffB.user.id));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staffB.user.id, role: "staff", createdAt: new Date() });
  });

  async function recipientsOf(subject: string): Promise<string[]> {
    const rows = await db.select({ recipientUserId: notifications.recipientUserId }).from(notifications).where(eq(notifications.orgId, orgId));
    // Filter isn't strictly needed (each test uses a fresh org) but keeps
    // intent explicit if this test file ever shares state across cases.
    void subject;
    return rows.map((r) => r.recipientUserId);
  }

  it("recipientRoles only: unchanged default behavior, notifies every matching role", async () => {
    await notificationsService.notify(orgId, {
      subject: "roles-only test",
      text: "roles-only test",
      recipientRoles: ["staff"],
      inApp: { type: "test_event", message: "roles-only test" },
    });
    const recipients = await recipientsOf("roles-only test");
    expect(recipients.sort()).toEqual([staffAUserId, staffBUserId].sort());
    expect(recipients).not.toContain(ownerUserId);
  });

  it("recipientUserIds only: notifies EXACTLY those ids — an Owner not listed must NOT be notified", async () => {
    await notificationsService.notify(orgId, {
      subject: "userIds-only test",
      text: "userIds-only test",
      recipientUserIds: [staffAUserId],
      inApp: { type: "test_event", message: "userIds-only test" },
    });
    const recipients = await recipientsOf("userIds-only test");
    expect(recipients).toEqual([staffAUserId]);
    expect(recipients).not.toContain(ownerUserId);
    expect(recipients).not.toContain(staffBUserId);
  });

  it("neither param passed: falls back to [\"owner\"], matching pre-S-10.20 behavior exactly", async () => {
    await notificationsService.notify(orgId, {
      subject: "default test",
      text: "default test",
      inApp: { type: "test_event", message: "default test" },
    });
    const recipients = await recipientsOf("default test");
    expect(recipients).toEqual([ownerUserId]);
  });

  it("both params passed: notifies the union, with no duplicate row for a recipient matching both", async () => {
    await notificationsService.notify(orgId, {
      subject: "union test",
      text: "union test",
      recipientRoles: ["owner"],
      recipientUserIds: [staffAUserId, ownerUserId],
      inApp: { type: "test_event", message: "union test" },
    });
    const recipients = await recipientsOf("union test");
    expect(recipients.sort()).toEqual([ownerUserId, staffAUserId].sort());
    expect(recipients.filter((id) => id === ownerUserId)).toHaveLength(1);
  });
});
