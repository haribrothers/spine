import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CatalogBundle } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { member, quoteLines, quotes, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-QUO-25 — saving a quote's lines as a bundle, and managing bundles
 * under the catalogue's own/others rules. Requires local Postgres.
 */
describe("US-QUO-25 · save quote lines as a reusable bundle (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-quo-25-${randomUUID()}@example.com`;
  const staffEmail = `us-quo-25-staff-${randomUUID()}@example.com`;
  let cookie: string;
  let staffCookie: string;
  let orgId: string;
  let quoteId: string;

  const call = (method: string, route: string, body?: unknown, who = cookie) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    expect((await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } })).status).toBeLessThan(300);
    const [quote] = await db.select().from(quotes).where(and(eq(quotes.orgId, orgId), isNotNull(quotes.number))).limit(1);
    quoteId = quote!.id;

    // Staff whose Team may edit only their own catalogue records.
    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Staff" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Own catalogue ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values([
      { teamId: team!.id, capability: "catalog.open", granted: true },
      { teamId: team!.id, capability: "catalog.edit_own", granted: true },
      { teamId: team!.id, capability: "catalog.delete_own", granted: true },
    ]);
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, staffEmail]));
  });

  it("needs a name: 'Give the bundle a name.'", async () => {
    const res = await call("POST", "/catalog-bundles", { name: "  ", sourceQuoteId: quoteId });
    expect(res.status).toBe(400);
    expect(await message(res)).toBe("Give the bundle a name.");
  });

  it("copies the quote's lines with their prices and tax and lists the bundle", async () => {
    const lines = await db.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId)).orderBy(quoteLines.sortOrder);
    const res = await call("POST", "/catalog-bundles", { name: "Electrical outlets — per room", description: "Outlets, labour and testing", sourceQuoteId: quoteId });
    expect(res.status).toBeLessThan(300);
    const bundle = (await res.json()) as CatalogBundle;
    expect(bundle.lines.map((l) => [l.name, l.unitPriceAmount, l.taxRateId])).toEqual(lines.map((l) => [l.name, l.unitPriceAmount.toString(), l.taxRateId]));
    expect(bundle.totalAmount).toBe(lines.reduce((s, l) => s + l.lineTotalAmount, 0n).toString());
    const listed = (await (await call("GET", "/catalog-bundles")).json()) as CatalogBundle[];
    expect(listed.map((b) => b.name)).toContain("Electrical outlets — per room");
  });

  it("is unchanged when its source quote changes later", async () => {
    const bundle = (await (await call("POST", "/catalog-bundles", { name: "Snapshot check", sourceQuoteId: quoteId })).json()) as CatalogBundle;
    await db.update(quoteLines).set({ name: "Renamed on the quote", unitPriceAmount: 1n }).where(eq(quoteLines.quoteId, quoteId));
    const after = (await (await call("GET", `/catalog-bundles/${bundle.id}`)).json()) as CatalogBundle;
    expect(after.lines).toEqual(bundle.lines);
  });

  it("applies catalogue own/others rules to editing and archiving", async () => {
    const ownersBundle = (await (await call("POST", "/catalog-bundles", { name: "Owner's bundle", sourceQuoteId: quoteId })).json()) as CatalogBundle;
    expect((await call("PUT", `/catalog-bundles/${ownersBundle.id}`, { name: "Renamed by staff" }, staffCookie)).status).toBe(403);
    expect((await call("POST", `/catalog-bundles/${ownersBundle.id}/archive`, undefined, staffCookie)).status).toBe(403);

    const staffBundle = (await (await call("POST", "/catalog-bundles", { name: "Staff bundle", sourceQuoteId: quoteId }, staffCookie)).json()) as CatalogBundle;
    expect((await call("PUT", `/catalog-bundles/${staffBundle.id}`, { name: "Staff bundle v2" }, staffCookie)).status).toBeLessThan(300);
    expect((await call("POST", `/catalog-bundles/${staffBundle.id}/archive`, undefined, staffCookie)).status).toBeLessThan(300);
    const active = (await (await call("GET", "/catalog-bundles")).json()) as CatalogBundle[];
    expect(active.map((b) => b.id)).not.toContain(staffBundle.id);
    expect((await call("POST", `/catalog-bundles/${staffBundle.id}/restore`, undefined, staffCookie)).status).toBeLessThan(300);
    expect((await call("DELETE", `/catalog-bundles/${staffBundle.id}`, undefined, staffCookie)).status).toBeLessThan(300);
    expect((await call("GET", `/catalog-bundles/${staffBundle.id}`)).status).toBe(404);
  });
});
