import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-INV-18 — Settings › Automatic reminders: the `invoice_reminders`
 * setting (Owner only) and its email preview. Requires local Postgres.
 */
describe("US-INV-18 · turn on automatic payment reminders (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-18-${randomUUID()}@example.com`;
  const freshEmail = `us-inv-18-fresh-${randomUUID()}@example.com`;
  const staffEmail = `us-inv-18-staff-${randomUUID()}@example.com`;
  let cookie: string;
  let freshCookie: string;
  let staffCookie: string;

  const put = (value: unknown, who = cookie) =>
    fetch(`${testApp.baseUrl}/org/settings/invoice_reminders`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: JSON.stringify({ value }),
    });
  const preview = (who: string) => fetch(`${testApp.baseUrl}/invoice-reminders/preview`, { headers: { cookie: who } });
  const valid = { enabled: true, offsets: [0, 7, 14], repeatEvery: null, repeatMax: null, sendAt: "09:00" };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    expect((await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } })).status).toBeLessThan(300);
    freshCookie = (await signUp(testApp.baseUrl, { email: freshEmail, password: "testpassword123", name: "Fresh" })).cookie;

    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Staff" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, freshEmail, staffEmail]));
  });

  it("an Owner saves the schedule", async () => {
    expect((await put(valid)).status).toBeLessThan(300);
    const saved = (await (await fetch(`${testApp.baseUrl}/org/settings/invoice_reminders`, { headers: { cookie } })).json()) as { value: unknown };
    expect(saved.value).toEqual(valid);
  });

  it("turning it on with nothing ticked is refused: 'Pick at least one reminder.'", async () => {
    const res = await put({ ...valid, offsets: [] });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Pick at least one reminder.");
  });

  it("Staff can't change it or preview it", async () => {
    expect((await put(valid, staffCookie)).status).toBe(403);
    expect((await preview(staffCookie)).status).toBe(403);
  });

  it("previews the reminder for the most overdue invoice", async () => {
    const body = (await (await preview(cookie)).json()) as { subject: string; html: string; sample: boolean };
    expect(body.sample).toBe(false);
    expect(body.subject).toMatch(/^Reminder: invoice INV-\d+ is \d+ days? overdue$/);
    expect(body.html).toContain("already paid, thank you");
  });

  it("previews a sample when nothing is overdue", async () => {
    const body = (await (await preview(freshCookie)).json()) as { subject: string; sample: boolean };
    expect(body).toMatchObject({ sample: true, subject: "Reminder: invoice INV-0000 is 7 days overdue" });
  });
});
