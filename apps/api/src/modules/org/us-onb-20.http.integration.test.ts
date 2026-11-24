import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INDUSTRY_TEMPLATES, type IndustryTemplateValue, type TemplateSeedResult } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, expenseCategories, member } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/** US-ONB-20 (D-193) — the four new industry templates set up their accounts, categories and modules. Requires local Postgres. */
describe("US-ONB-20 · start from a template for my industry (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;

  const owner = async () => {
    const o = await signUp(testApp.baseUrl, { email: `us-onb-20-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    const [m] = await db.select().from(member).where(eq(member.userId, o.userId));
    return { cookie: o.cookie, orgId: m!.organizationId };
  };
  const call = (cookie: string, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const apply = async (cookie: string, template: string) => {
    const res = await call(cookie, "PUT", "/org/settings/industry_template", { value: { template } });
    expect(res.status).toBeLessThan(300);
    return ((await res.json()) as { seeded?: TemplateSeedResult }).seeded;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it.each(["interior_design", "trades", "it_services", "professional_services"] as IndustryTemplateValue[])("%s sets up its accounts and categories once", async (template) => {
    const { cookie, orgId } = await owner();
    const definition = INDUSTRY_TEMPLATES[template];
    const seeded = await apply(cookie, template);
    expect(seeded).toEqual({ template, accounts: definition.accounts.map((a) => `${a.code} · ${a.name}`), categories: definition.categories.map((c) => c.name), kept: [] });

    // Every category posts to an account that exists.
    const rows = await db.select({ name: expenseCategories.name, code: accounts.code }).from(expenseCategories).leftJoin(accounts, eq(accounts.id, expenseCategories.accountId)).where(eq(expenseCategories.orgId, orgId));
    for (const category of definition.categories) expect(rows).toContainEqual({ name: category.name, code: category.accountCode });

    // The note on Expenses › Categories names the template.
    const note = (await (await call(cookie, "GET", "/org/settings/industry_template_seed")).json()) as { value: TemplateSeedResult };
    expect(note.value.template).toBe(template);

    // A second run creates nothing.
    expect(await apply(cookie, template)).toEqual({ template, accounts: [], categories: [], kept: [] });
    expect(await db.select().from(expenseCategories).where(eq(expenseCategories.orgId, orgId))).toHaveLength(definition.categories.length);
  });

  it("keeps an account code and a category name that already exist", async () => {
    const { cookie, orgId } = await owner();
    await db.insert(accounts).values({ orgId, code: "5700", name: "Stock Parts", type: "expense" });
    await db.insert(expenseCategories).values({ orgId, name: "Labour" });
    const seeded = await apply(cookie, "trades");
    expect(seeded?.kept).toEqual(["Kept your existing account 5700 · Stock Parts", "Kept your existing category “Labour”"]);
    expect(seeded?.accounts).toEqual(["5710 · Tools & Equipment", "5720 · Vehicle Running"]);
    const [parts] = await db.select().from(expenseCategories).where(and(eq(expenseCategories.orgId, orgId), eq(expenseCategories.name, "Parts & consumables")));
    const [stock] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "5700")));
    expect(parts?.accountId).toBe(stock!.id);
  });

  it("Professional services starts without Jobs & field; the other new templates with everything", async () => {
    const pro = await owner();
    await apply(pro.cookie, "professional_services");
    expect(await (await call(pro.cookie, "GET", "/org/modules")).json()).toMatchObject({ jobsField: false, leadsMeetings: true, approvals: true, recurring: true });
    for (const template of ["interior_design", "trades", "it_services"]) {
      const o = await owner();
      await apply(o.cookie, template);
      expect(await (await call(o.cookie, "GET", "/org/modules")).json()).toMatchObject({ jobsField: true, leadsMeetings: true, approvals: true, recurring: true });
    }
  });
});
