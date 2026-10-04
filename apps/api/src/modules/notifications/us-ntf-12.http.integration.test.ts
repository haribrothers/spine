import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { NotificationsService } from "./notifications.service";
import { PushService } from "./push.service";

/**
 * US-NTF-12 — any member turns push on for their own device from their
 * profile; the routes are per-user, so Field and Staff need no owner.
 * Requires local Postgres.
 */
describe("US-NTF-12 · turn on push from my own profile (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let field: { cookie: string; userId: string };

  const subscription = {
    endpoint: `https://push.example/${randomUUID()}`,
    keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const ownerEmail = `us-ntf-12-owner-${randomUUID()}@example.com`;
    const fieldEmail = `us-ntf-12-field-${randomUUID()}@example.com`;
    emails.push(ownerEmail, fieldEmail);
    const owner = await signUp(testApp.baseUrl, { email: ownerEmail, password: "testpassword123", name: "Owner" });
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    field = await signUp(testApp.baseUrl, { email: fieldEmail, password: "testpassword123", name: "Marcus Field" });
    await db.update(member).set({ organizationId: orgId, role: "field", isPrimaryOwner: false }).where(eq(member.userId, field.userId));
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    if (emails.length) await db.delete(user).where(inArray(user.email, emails));
  });

  it("a Field member subscribes this device and sees it listed", async () => {
    const res = await fetch(`${testApp.baseUrl}/notifications/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: field.cookie },
      body: JSON.stringify(subscription),
    });
    expect(res.status).toBeLessThan(300);
    const list = (await (await fetch(`${testApp.baseUrl}/notifications/push/subscriptions`, { headers: { cookie: field.cookie } })).json()) as { endpoint: string }[];
    expect(list.map((s) => s.endpoint)).toContain(subscription.endpoint);
  });

  it("a notification for that member is pushed to their devices", async () => {
    const push = testApp.app.get(PushService);
    vi.spyOn(push, "isConfigured").mockReturnValue(true);
    const sent = vi.spyOn(push, "sendToUser").mockResolvedValue();
    await testApp.app.get(NotificationsService).notify(orgId, {
      subject: "You've been invited: Site walk",
      text: `You've been invited to "Site walk".`,
      recipientUserIds: [field.userId],
      inApp: { type: "meeting_invited", message: `You've been invited to "Site walk".`, link: "/meetings?id=m1" },
    });
    expect(sent).toHaveBeenCalledWith(orgId, field.userId, expect.objectContaining({ title: "You've been invited: Site walk", link: "/meetings?id=m1" }));
  });
});
