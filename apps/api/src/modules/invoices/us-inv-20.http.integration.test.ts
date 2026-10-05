import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/** `YYYY-MM-DD`, `days` after `date`. */
function plusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * US-INV-20 (D-092) — setting up a recurring invoice: saved schedules are
 * listed "Active" with their next date; a past start date is refused; and
 * every route needs `invoices.manage_recurring`. Requires local Postgres.
 */
describe("US-INV-20 · set up a recurring invoice (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-20-${randomUUID()}@example.com`;
  const grantedEmail = `us-inv-20-granted-${randomUUID()}@example.com`;
  const deniedEmail = `us-inv-20-denied-${randomUUID()}@example.com`;
  let cookie: string;
  let grantedCookie: string;
  let deniedCookie: string;
  let orgId: string;
  let contactId: string;
  const today = orgClock().date;

  const body = (overrides: Record<string, unknown> = {}) => ({
    name: "Monthly maintenance — Hotel lobby",
    contactId,
    currency: "USD",
    frequency: "monthly",
    dayRule: "1",
    startsOn: today,
    endsOn: null,
    maxCount: null,
    dueDays: 14,
    mode: "issue_and_email",
    lines: [{ type: "item", name: "Monthly maintenance visit", quantity: 1, unitPriceAmount: "125000", taxRatePercentage: 10 }],
    ...overrides,
  });
  const post = (data: unknown, who = cookie) =>
    fetch(`${testApp.baseUrl}/recurring-invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: JSON.stringify(data),
    });
  const list = (who = cookie) => fetch(`${testApp.baseUrl}/recurring-invoices`, { headers: { cookie: who } });

  async function staffMember(memberEmail: string, granted: boolean) {
    const staff = await signUp(testApp.baseUrl, { email: memberEmail, password: "testpassword123", name: "Staff" });
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Recurring ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "invoices.manage_recurring", granted });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    return staff.cookie;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Bluewater Hospitality Group", createdByUserId: owner.userId }).returning();
    contactId = contact!.id;
    grantedCookie = await staffMember(grantedEmail, true);
    deniedCookie = await staffMember(deniedEmail, false);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, grantedEmail, deniedEmail]));
  });

  it("a valid schedule saves as Active with its next invoice date and amount", async () => {
    const res = await post(body());
    expect(res.status).toBeLessThan(300);
    const saved = (await res.json()) as { id: string; status: string; nextRunOn: string; totalAmount: string; contactName: string; lines: unknown[] };
    const firstOfNextMonth = today.slice(8) === "01" ? today : plusDays(`${today.slice(0, 8)}01`, 40).slice(0, 8) + "01";
    expect(saved).toMatchObject({ status: "active", nextRunOn: firstOfNextMonth, totalAmount: "137500", contactName: "Bluewater Hospitality Group" });
    expect(saved.lines).toHaveLength(1);

    const rows = (await (await list()).json()) as { id: string; status: string; nextRunOn: string }[];
    expect(rows).toEqual([expect.objectContaining({ id: saved.id, status: "active", nextRunOn: firstOfNextMonth })]);
  });

  it("a start date in the past is refused: 'Pick today or a later start date.'", async () => {
    const res = await post(body({ startsOn: plusDays(today, -1) }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Pick today or a later start date.");
  });

  it("a schedule needs a line, and can't end before its first invoice", async () => {
    const noLines = await post(body({ lines: [] }));
    expect(noLines.status).toBe(400);
    expect(((await noLines.json()) as { message: string }).message).toBe("Add at least one line.");
    // Monthly on the 1st, ending today: the first invoice would be next month.
    if (today.slice(8) !== "01") {
      const endsFirst = await post(body({ endsOn: today }));
      expect(endsFirst.status).toBe(400);
      expect(((await endsFirst.json()) as { message: string }).message).toBe("This schedule ends before its next invoice. Pick a later end date.");
    }
  });

  it("Staff whose Team grants 'Manage recurring invoices' can list and create", async () => {
    expect((await list(grantedCookie)).status).toBe(200);
    expect((await post(body({ name: "Quarterly HVAC service", frequency: "quarterly", dayRule: "15", mode: "draft" }), grantedCookie)).status).toBeLessThan(300);
  });

  it("without invoices.manage_recurring the API returns 403", async () => {
    expect((await list(deniedCookie)).status).toBe(403);
    expect((await post(body(), deniedCookie)).status).toBe(403);
  });
});
