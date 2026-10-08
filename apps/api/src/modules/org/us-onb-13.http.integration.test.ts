import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, expenseCategories, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Seeded = { accounts: string[]; categories: string[]; kept: string[] };

/**
 * US-ONB-13 (D-129) — choosing Construction / Contracting sets up the site
 * cost accounts and categories once, keeps whatever already exists, and
 * never removes them. Requires local Postgres.
 */
describe("US-ONB-13 · start a construction business with site cost categories (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];

  async function owner() {
    const email = `us-onb-13-${randomUUID()}@example.com`;
    emails.push(email);
    const { cookie, userId } = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    const orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    return { cookie, userId, orgId };
  }

  const choose = async (cookie: string, template: string) => {
    const res = await fetch(`${testApp.baseUrl}/org/settings/industry_template`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: JSON.stringify({ value: { template } }),
    });
    return { status: res.status, body: (await res.json()) as { seeded?: Seeded; message?: string } };
  };

  const categoriesOf = async (orgId: string) =>
    db
      .select({ name: expenseCategories.name, code: accounts.code, createdByUserId: expenseCategories.createdByUserId })
      .from(expenseCategories)
      .leftJoin(accounts, eq(expenseCategories.accountId, accounts.id))
      .where(eq(expenseCategories.orgId, orgId));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("choosing Construction adds accounts 5300, 5400, 5500 and the six site cost categories", async () => {
    const o = await owner();
    const { status, body } = await choose(o.cookie, "construction");
    expect(status).toBeLessThan(300);
    expect(body.seeded).toEqual({
      template: "construction",
      accounts: ["5300 · Plant & Equipment Hire", "5400 · Fuel & Freight", "5500 · Site Overheads & Permits"],
      categories: ["Materials", "Subcontractors", "Site labour", "Plant & equipment hire", "Fuel & freight", "Site overheads & permits"],
      kept: [],
    });
    const rows = await db.select().from(accounts).where(and(eq(accounts.orgId, o.orgId), inArray(accounts.code, ["5300", "5400", "5500"])));
    expect(rows.map((r) => [r.code, r.name, r.type, r.isSystem]).sort()).toEqual([
      ["5300", "Plant & Equipment Hire", "expense", false],
      ["5400", "Fuel & Freight", "expense", false],
      ["5500", "Site Overheads & Permits", "expense", false],
    ]);
    const categories = await categoriesOf(o.orgId);
    expect(categories.map((c) => [c.name, c.code]).sort()).toEqual(
      [
        ["Materials", "5000"],
        ["Subcontractors", "5100"],
        ["Site labour", "5200"],
        ["Plant & equipment hire", "5300"],
        ["Fuel & freight", "5400"],
        ["Site overheads & permits", "5500"],
      ].sort(),
    );
    expect(new Set(categories.map((c) => c.createdByUserId))).toEqual(new Set([o.userId]));
  });

  it("existing account codes and category names are kept, not duplicated, and listed in the note", async () => {
    const o = await owner();
    await db.update(accounts).set({ code: "5300", name: "Vehicle Lease" }).where(and(eq(accounts.orgId, o.orgId), eq(accounts.code, "6300")));
    await db.insert(expenseCategories).values({ orgId: o.orgId, name: "materials", createdByUserId: o.userId });
    const { body } = await choose(o.cookie, "construction");
    expect(body.seeded!.kept).toEqual(["Kept your existing account 5300 · Vehicle Lease", "Kept your existing category “materials”"]);
    expect(body.seeded!.accounts).toEqual(["5400 · Fuel & Freight", "5500 · Site Overheads & Permits"]);
    expect(body.seeded!.categories).not.toContain("Materials");
    expect(await db.select().from(accounts).where(and(eq(accounts.orgId, o.orgId), eq(accounts.code, "5300")))).toHaveLength(1);
    const categories = await categoriesOf(o.orgId);
    expect(categories.filter((c) => c.name.toLowerCase() === "materials")).toHaveLength(1);
    expect(categories.find((c) => c.name === "Plant & equipment hire")?.code).toBe("5300");
  });

  it("applying it twice creates nothing the second time; switching template keeps everything", async () => {
    const o = await owner();
    await choose(o.cookie, "construction");
    const again = await choose(o.cookie, "construction");
    expect(again.body.seeded).toEqual({ template: "construction", accounts: [], categories: [], kept: [] });
    expect(await categoriesOf(o.orgId)).toHaveLength(6);

    expect((await choose(o.cookie, "generic")).body.seeded).toBeUndefined();
    expect(await categoriesOf(o.orgId)).toHaveLength(6);
    expect(await db.select().from(accounts).where(and(eq(accounts.orgId, o.orgId), eq(accounts.code, "5500")))).toHaveLength(1);
    const note = (await (await fetch(`${testApp.baseUrl}/org/settings/industry_template_seed`, { headers: { cookie: o.cookie } })).json()) as { value: Seeded };
    expect(note.value.categories).toHaveLength(6);
  });

  it("the seeded categories are ordinary: they can be renamed and archived", async () => {
    const o = await owner();
    await choose(o.cookie, "construction");
    const [labour] = await db.select().from(expenseCategories).where(and(eq(expenseCategories.orgId, o.orgId), eq(expenseCategories.name, "Site labour")));
    const call = (method: string, path: string, body?: unknown) =>
      fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: o.cookie }, body: body ? JSON.stringify(body) : undefined });
    expect((await call("PUT", `/expense-categories/${labour!.id}`, { name: "Labour hire" })).status).toBeLessThan(300);
    expect((await call("POST", `/expense-categories/${labour!.id}/archive`)).status).toBeLessThan(300);
    const [row] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, labour!.id));
    expect(row).toMatchObject({ name: "Labour hire" });
    expect(row!.archivedAt).not.toBeNull();
  });

  it("refuses an unknown template", async () => {
    const o = await owner();
    const res = await choose(o.cookie, "shipbuilding");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Pick one of the industry templates.");
  });
});
