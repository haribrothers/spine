import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-PAY-18 — refunds are their own Team right: off for General Staff, enforced by the API. Requires local Postgres. */
describe("US-PAY-18 · let a Team refund customers (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let generalStaff: string;
  let paymentId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const refund = (who: Who) => call(who, "POST", "/customer-refunds", { sourcePaymentId: paymentId, amount: "100", date: "2026-10-01", method: "cash" });

  async function newUser(name: string): Promise<Who> {
    const email = `us-pay-18-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }
  async function join(who: Who, role: "staff" | "field") {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role === "staff") await db.insert(teamMemberships).values({ teamId: generalStaff, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    generalStaff = (await db.select().from(teams).where(and(eq(teams.orgId, orgId), eq(teams.isDefault, true))))[0]!.id;
    Object.assign(staff, await newUser("staff"));
    await join(staff, "staff");
    Object.assign(field, await newUser("field"));
    await join(field, "field");
    const [c] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const res = await call(owner, "POST", "/payments", { contactId: c!.id, date: "2026-09-20", method: "cash", currency: "USD", amount: "50000" });
    paymentId = ((await res.json()) as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("General Staff start without it and get 403; granting it lets them refund; Field never", async () => {
    const [grant] = await db.select().from(teamPrivileges).where(and(eq(teamPrivileges.teamId, generalStaff), eq(teamPrivileges.capability, "payments.refund")));
    expect(grant!.granted).toBe(false);
    expect((await refund(staff)).status).toBe(403);
    expect((await refund(field)).status).toBe(403);

    const saved = await call(owner, "PUT", `/org/teams/${generalStaff}/privileges`, { privileges: [{ capability: "payments.refund", granted: true }] });
    expect(((await saved.json()) as Record<string, boolean>)["payments.refund"]).toBe(true);
    expect((await refund(staff)).status).toBe(201);
    expect((await refund(field)).status).toBe(403);
  });
});
