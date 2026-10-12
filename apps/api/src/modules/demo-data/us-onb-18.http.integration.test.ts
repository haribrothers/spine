import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildDemoPlan, DEMO_COUNTRIES, DEMO_INDUSTRIES, type DemoDataStatus } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, invoices, journalEntries, member, settings, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { ContactsService } from "../contacts/contacts.service";
import { InvoicesService } from "../invoices/invoices.service";
import { ReportsService } from "../reports/reports.service";
import { DemoSeederService } from "./demo-seeder.service";

/** US-ONB-35 — the demo's people, `role:email`. */
const DEMO_PEOPLE = [
  "staff:sarah.mendes.demo@example.com",
  "staff:neha.kapoor.demo@example.com",
  "staff:kavya.iyer.demo@example.com",
  "field:marcus.webb.demo@example.com",
  "field:ravi.kumar.demo@example.com",
  "field:tom.becker.demo@example.com",
];

/**
 * US-ONB-18 (D-192) — a demo business for every country and industry:
 * its settings, six months of history in date order, reports with
 * figures, and the rules on choosing a country. Requires local Postgres.
 */
describe("US-ONB-18 · choose the country and industry of the demo business (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;

  const owner = async () => {
    const o = await signUp(testApp.baseUrl, { email: `us-onb-18-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    const [m] = await db.select().from(member).where(eq(member.userId, o.userId));
    return { cookie: o.cookie, userId: o.userId, orgId: m!.organizationId };
  };
  const seed = (cookie: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const status = async (cookie: string) => (await (await fetch(`${testApp.baseUrl}/demo-data/status`, { headers: { cookie } })).json()) as DemoDataStatus;
  const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
  const setting = async (orgId: string, key: string) => (await db.select().from(settings).where(and(eq(settings.orgId, orgId), eq(settings.key, key))))[0]?.value as Record<string, unknown> | undefined;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  // Every India industry (the hand-written GST path), and every other country once with a different
  // industry each, so every country and every industry loads through the real services. All 35
  // combinations are checked as plans in @spine/shared (us-onb-18.test.ts), which is where most
  // content mistakes show; loading all 35 here added a minute and a half to CI.
  const others = DEMO_COUNTRIES.filter((c) => c !== "IN");
  const pairs = [
    ...DEMO_INDUSTRIES.map((industry) => ["IN", industry] as const),
    ["US", "construction"] as const,
    ...others.map((country, i) => [country, DEMO_INDUSTRIES[(i + 1) % DEMO_INDUSTRIES.length]!] as const),
  ];

  it.each(pairs)("%s %s loads with its settings, history in date order and reports with figures", async (country, industry) => {
    const { cookie, orgId } = await owner();
    const res = await seed(cookie, { country, industry });
    expect(res.status).toBe(201);
    const plan = buildDemoPlan(country, industry);

    expect(await status(cookie)).toEqual({ hasDemoData: true, loaded: { country, industry, businessName: plan.business.name }, country: country === "US" ? null : country, countryLocked: false });
    expect(await setting(orgId, "currency")).toEqual(plan.currency);
    expect(await setting(orgId, "industry_template")).toEqual({ template: industry });
    expect((await setting(orgId, "business_profile"))?.name).toBe(plan.business.name);
    expect(await setting(orgId, "financial_year_start")).toEqual(plan.financialYearStart);
    if (country !== "US") expect((await setting(orgId, "tax_profile"))?.country).toBe(country);

    // Every entry is demo, and the books balance.
    const entries = await db.select({ isDemo: journalEntries.isDemo, date: journalEntries.date }).from(journalEntries).where(eq(journalEntries.orgId, orgId));
    expect(entries.every((e) => e.isDemo)).toBe(true);
    const today = orgClock().date;
    const reports = testApp.app.get(ReportsService);
    const trial = await reports.trialBalance(orgId, today);
    expect(trial.balanced).toBe(true);
    expect(BigInt(trial.totalDebit)).toBeGreaterThan(0n);
    const from = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) - 200)).toISOString().slice(0, 10);
    const pl = await reports.profitAndLoss(orgId, from, today);
    expect(BigInt(pl.totalIncome)).toBeGreaterThan(0n);
    expect(BigInt(pl.totalExpenses)).toBeGreaterThan(0n);
    expect(BigInt((await reports.receivables(orgId)).totalOutstanding)).toBeGreaterThan(0n);

    if (plan.ordering === "dated") {
      // About six months of history ending today, numbered in date order.
      const earliest = entries.map((e) => iso(e.date)).sort()[0]!;
      const days = Math.round((Date.parse(today) - Date.parse(earliest)) / 86_400_000);
      expect(days).toBeGreaterThanOrEqual(150);
      expect(days).toBeLessThanOrEqual(185);
      const issued = await db.select({ number: invoices.number, issueDate: invoices.issueDate }).from(invoices).where(and(eq(invoices.orgId, orgId), isNotNull(invoices.number))).orderBy(asc(invoices.number));
      const dates = issued.map((i) => iso(i.issueDate));
      expect(dates).toEqual([...dates].sort());
      expect(issued[0]!.number).toBe("DEMO-INV-0001");
      expect(issued.some((i) => iso(i.issueDate) < today)).toBe(true);
    }
  }, 120_000);

  it("refuses a second demo while one is loaded", async () => {
    const { cookie } = await owner();
    expect((await seed(cookie, { country: "GB", industry: "trades" })).status).toBe(201);
    const again = await seed(cookie, { country: "GB", industry: "it_services" });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: "DEMO_DATA_LOADED", message: "Demo data is already loaded. Delete it first to load another demo business." });
  }, 120_000);

  it("once the business has records of its own, keeps its country and settings and only adds the industry", async () => {
    const { cookie, orgId, userId } = await owner();
    await fetch(`${testApp.baseUrl}/org/tax/profile`, { method: "PUT", headers: { cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: JSON.stringify({ country: "AU" }) });
    await fetch(`${testApp.baseUrl}/org/settings/currency`, { method: "PUT", headers: { cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: JSON.stringify({ value: { code: "AUD", locale: "en-AU" } }) });
    await fetch(`${testApp.baseUrl}/org/settings/industry_template`, { method: "PUT", headers: { cookie, "Idempotency-Key": randomUUID(), "Content-Type": "application/json" }, body: JSON.stringify({ value: { template: "generic" } }) });
    const contact = await testApp.app.get(ContactsService).create(orgId, userId, { type: "customer", isCompany: true, name: "Own customer" } as never);
    const draft = await testApp.app.get(InvoicesService).create(orgId, userId, { contactId: contact.id, type: "standard", currency: "AUD", lines: [{ type: "item", name: "Advice", quantity: 1, unitPriceAmount: 10000n, discountPercentage: 0, taxRatePercentage: 0, isTaxInclusive: false }] } as never);
    await testApp.app.get(InvoicesService).issue(orgId, draft.id, userId);

    expect(await status(cookie)).toMatchObject({ hasDemoData: false, country: "AU", countryLocked: true });
    const wrong = await seed(cookie, { country: "IN", industry: "trades" });
    expect(wrong.status).toBe(409);
    expect(await wrong.json()).toMatchObject({ error: "DEMO_COUNTRY_LOCKED", message: "Your business already has its own records, so demo data uses its country: Australia (GST)." });

    expect((await seed(cookie, { industry: "it_services" })).status).toBe(201);
    expect(await status(cookie)).toMatchObject({ hasDemoData: true, loaded: { country: "AU", industry: "it_services" }, countryLocked: true });
    // Settings stay the business's own; the IT template's categories were added.
    expect(await setting(orgId, "industry_template")).toEqual({ template: "generic" });
    expect((await setting(orgId, "business_profile"))?.name).not.toBe("Bluegum Labs");
    expect((await setting(orgId, "industry_template_seed"))?.template).toBe("it_services");
  }, 120_000);

  it("creates the demo Staff and Field people when sign-up is closed, as it is on any real install (US-AUTH-08)", async () => {
    const { cookie, orgId } = await owner();
    // From scratch: the demo people don't exist yet, as on a new install.
    await db.delete(user).where(inArray(user.email, DEMO_PEOPLE.map((p) => p.split(":")[1]!)));
    const before = process.env.SPINE_ALLOW_OPEN_SIGNUP;
    process.env.SPINE_ALLOW_OPEN_SIGNUP = "false";
    try {
      expect((await seed(cookie, { country: "IN", industry: "construction" })).status).toBe(201);
    } finally {
      process.env.SPINE_ALLOW_OPEN_SIGNUP = before;
    }
    const people = await db.select({ role: member.role, email: user.email }).from(member).innerJoin(user, eq(user.id, member.userId)).where(and(eq(member.organizationId, orgId), eq(member.isDemo, true)));
    expect(people.map((p) => `${p.role}:${p.email}`).sort()).toEqual([...DEMO_PEOPLE].sort());
    const signIn = await fetch(`${testApp.baseUrl}/api/auth/sign-in/email`, { method: "POST", headers: { "Content-Type": "application/json", Origin: process.env.APP_URL ?? "http://localhost:3000" }, body: JSON.stringify({ email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" }) });
    expect(signIn.status).toBe(200);
  }, 120_000);

  it("leaves nothing behind when loading fails part-way, so it can be tried again", async () => {
    const { cookie, orgId } = await owner();
    const seeder = testApp.app.get(DemoSeederService);
    const run = seeder.run.bind(seeder);
    const spy = vi.spyOn(seeder, "run").mockImplementationOnce(async (...args) => {
      await run(...args);
      throw new Error("Storage went away");
    });
    try {
      expect((await seed(cookie, { country: "GB", industry: "trades" })).status).toBe(500);
    } finally {
      spy.mockRestore();
    }
    expect(await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.isDemo, true)))).toHaveLength(0);
    expect(await db.select().from(journalEntries).where(eq(journalEntries.orgId, orgId))).toHaveLength(0);
    expect((await status(cookie)).hasDemoData).toBe(false);
    expect((await seed(cookie, { country: "GB", industry: "trades" })).status).toBe(201);
  }, 120_000);

  it("loads US construction (Riverstone Builders) without a choice, and rejects an unknown country", async () => {
    const { cookie } = await owner();
    expect((await seed(cookie, { country: "FR" })).status).toBe(400);
    const res = await seed(cookie);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ country: "US", industry: "construction", businessName: "Riverstone Builders" });
  }, 120_000);
});
