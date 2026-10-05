import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, invoices, member, session as sessionTable, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { EmailService, type SendEmailInput } from "../email/email.service";
import { DigestService } from "../dashboard/digest.service";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string; email: string };

/**
 * US-NTF-14 — `PUT /users/me/notification-preferences`: turn the digest on
 * or off, choose "Send at" and days, for yourself only; `GET /users/me`
 * reports the choice, or the role default (D-093). Requires local Postgres.
 */
describe("US-NTF-14 · choose when my digest arrives (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner = { cookie: "", userId: "", email: "" };
  const staff = { cookie: "", userId: "", email: "" };

  const me = async (who: Who) => (await (await fetch(`${testApp.baseUrl}/users/me`, { headers: { cookie: who.cookie } })).json()) as Record<string, unknown>;
  const put = (who: Who, body: unknown) =>
    fetch(`${testApp.baseUrl}/users/me/notification-preferences`, {
      method: "PUT",
      headers: { cookie: who.cookie, "content-type": "application/json", "Idempotency-Key": randomUUID() },
      body: JSON.stringify(body),
    });

  async function newUser(name: string, into: Who) {
    const email = `us-ntf-14-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(into, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }), { email });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    await newUser("Alex Morgan", owner);
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await newUser("Sarah Mendes", staff);
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("defaults: on for Owners at 7:00 AM Monday to Friday, off for Staff", async () => {
    expect(await me(owner)).toMatchObject({ digestEnabled: true, digestTime: "07:00", digestDays: "weekdays" });
    expect(await me(staff)).toMatchObject({ digestEnabled: false, digestTime: "07:00", digestDays: "weekdays" });
  });

  it("saves my choice and reports it back", async () => {
    const res = await put(staff, { digestEnabled: true, digestTime: "06:30", digestDays: "daily" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ digestEnabled: true, digestTime: "06:30", digestDays: "daily" });
    expect(await me(staff)).toMatchObject({ digestEnabled: true, digestTime: "06:30", digestDays: "daily" });
    // Only my own row changed.
    expect(await me(owner)).toMatchObject({ digestEnabled: true, digestTime: "07:00" });
  });

  it("refuses a time off the quarter hour or unknown days", async () => {
    expect((await put(owner, { digestEnabled: true, digestTime: "06:31", digestDays: "weekdays" })).status).toBe(400);
    expect((await put(owner, { digestEnabled: true, digestTime: "07:00", digestDays: "weekends" })).status).toBe(400);
  });

  it("turned off, no digest is sent; moved to 6:30, it arrives at 6:30", async () => {
    const [maple] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const today = orgClock().date;
    await db.insert(invoices).values({ orgId, contactId: maple!.id, status: "issued", number: "INV-0002", currency: "USD", totalAmount: 1000n, dueDate: new Date(`2000-01-01T00:00:00Z`), createdByUserId: owner.userId });

    const sent: SendEmailInput[] = [];
    const emailService = testApp.app.get(EmailService);
    vi.spyOn(emailService, "isConfigured").mockReturnValue(true);
    vi.spyOn(emailService, "send").mockImplementation(async (input) => void sent.push(input));
    const digest = testApp.app.get(DigestService);
    const at = (h: number, m: number) => {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };

    expect((await put(owner, { digestEnabled: false, digestTime: "07:00", digestDays: "daily" })).status).toBe(200);
    await digest.runDue(at(7, 5));
    expect(sent.filter((m) => m.to === owner.email)).toHaveLength(0);

    await put(owner, { digestEnabled: true, digestTime: "06:30", digestDays: "daily" });
    await db.update(user).set({ digestLastSentOn: null }).where(eq(user.id, owner.userId));
    await digest.runDue(at(6, 15));
    expect(sent.filter((m) => m.to === owner.email)).toHaveLength(0);
    await digest.runDue(at(6, 30));
    expect(sent.filter((m) => m.to === owner.email)).toHaveLength(1);
    expect(today).toBe(orgClock(at(6, 30)).date);
  });
});
