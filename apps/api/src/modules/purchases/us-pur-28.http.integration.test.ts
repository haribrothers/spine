import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-PUR-28 — vendor credit rights: granted to General Staff, enforced per action, Field never. Requires local Postgres. */
describe("US-PUR-28 · let a Team manage vendor credits (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let generalStaff: string;
  let creditId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });

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
    for (const [who, name] of [[owner, "owner"], [staff, "staff"], [field, "field"]] as const) {
      const email = `us-pur-28-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    generalStaff = (await db.select().from(teams).where(and(eq(teams.orgId, orgId), eq(teams.isDefault, true))))[0]!.id;
    await join(staff, "staff");
    await join(field, "field");
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    const res = await call(staff, "POST", "/vendor-credits", { contactId: vendor!.id, vendorReference: "CN-1", date: "2026-10-03", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "1000" }] });
    creditId = ((await res.json()) as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("General Staff have every vendor credit right", async () => {
    const rows = await db.select().from(teamPrivileges).where(and(eq(teamPrivileges.teamId, generalStaff), like(teamPrivileges.capability, "vendor_credits.%")));
    // With Open Vendor Credits (US-TEAM-30).
    expect(rows).toHaveLength(8);
    expect(rows.every((r) => r.granted)).toBe(true);
  });

  it("without 'Record vendor credits' recording is refused", async () => {
    await call(owner, "PUT", `/org/teams/${generalStaff}/privileges`, { privileges: [{ capability: "vendor_credits.record", granted: false }] });
    expect((await call(staff, "POST", `/vendor-credits/${creditId}/record`)).status).toBe(403);
    await call(owner, "PUT", `/org/teams/${generalStaff}/privileges`, { privileges: [{ capability: "vendor_credits.record", granted: true }] });
    expect((await call(staff, "POST", `/vendor-credits/${creditId}/record`)).status).toBe(201);
  });

  it("Field get 403 on every vendor credit route", async () => {
    const id = creditId;
    const routes: [string, string, unknown?][] = [
      ["GET", "/vendor-credits"],
      ["GET", `/vendor-credits/${id}`],
      ["GET", `/vendor-credits/${id}/history`],
      ["POST", "/vendor-credits", {}],
      ["PUT", `/vendor-credits/${id}`, {}],
      ["DELETE", `/vendor-credits/${id}`],
      ["POST", `/vendor-credits/${id}/record`],
      ["POST", `/vendor-credits/${id}/apply`, { allocations: [] }],
      ["DELETE", `/vendor-credits/${id}/allocations/${randomUUID()}`],
      ["POST", `/vendor-credits/${id}/refunds`, {}],
      ["DELETE", `/vendor-refunds/${randomUUID()}`],
      ["POST", `/vendor-credits/${id}/void`, { reason: "x" }],
    ];
    for (const [method, path, body] of routes) expect((await call(field, method, path, body)).status, `${method} ${path}`).toBe(403);
  });
});
