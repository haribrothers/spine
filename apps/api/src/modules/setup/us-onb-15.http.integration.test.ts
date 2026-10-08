import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupProgress, type SetupStatus } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, moneyAccounts, numberSequences, openingBalances, session as sessionTable, settings } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/**
 * US-ONB-15 (D-155, D-194) — Set up Spine: each card's "Done" is worked out
 * from the business's data, "not needed" hides a card, Backups isn't
 * counted, Field app only applies with Jobs & field on, a loaded demo is
 * flagged, and the dashboard checklist counts what's left. Owner-only.
 * Requires local Postgres.
 */
describe("US-ONB-15 · open a setup page that shows what's left (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;

  const call = (cookie: string, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { cookie, "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body) });
  const status = async (cookie: string) => {
    const res = await call(cookie, "GET", "/org/setup-status");
    expect(res.status).toBe(200);
    return (await res.json()) as SetupStatus;
  };
  const doneOf = (s: SetupStatus) => Object.fromEntries(s.cards.map((c) => [c.key, c.done]));
  const owner = async () => {
    const o = await signUp(testApp.baseUrl, { email: `us-onb-15-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    const [m] = await db.select().from(member).where(eq(member.userId, o.userId));
    return { ...o, orgId: m!.organizationId };
  };
  /** A person of another role in the owner's organisation. */
  const joinAs = async (orgId: string, role: "staff" | "field") => {
    const p = await signUp(testApp.baseUrl, { email: `us-onb-15-${role}-${randomUUID()}@example.com`, password: "testpassword123", name: role });
    await db.delete(member).where(eq(member.userId, p.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: p.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, p.userId));
    return p;
  };
  const setSetting = (orgId: string, key: string, value: unknown) =>
    db
      .insert(settings)
      .values({ orgId, key, value: value as object })
      .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: value as object } });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("starts with everything to do, Backups uncounted, and turns each card Done as its data changes", async () => {
    const o = await owner();
    const fresh = await status(o.cookie);
    expect(fresh.cards.map((c) => c.key)).toEqual(["business", "tax", "accounts", "opening_balances", "bank_accounts", "payment_instructions", "documents", "numbering", "reminders", "modules", "team", "email", "backups", "field_app"]);
    expect(fresh.demoLoaded).toBe(false);
    const email = Boolean(process.env.SMTP_HOST);
    expect(doneOf(fresh)).toEqual({ business: false, tax: false, accounts: false, opening_balances: false, bank_accounts: false, payment_instructions: false, documents: false, numbering: false, reminders: false, modules: false, team: false, email, backups: null, field_app: false });
    expect(setupProgress(fresh.cards)).toEqual({ done: email ? 1 : 0, total: 13, toDo: email ? 12 : 13, notNeeded: 0 });

    await call(o.cookie, "PUT", "/org/settings/business_profile", { value: { name: "Harbour Plumbing", address: "1 Quay St", paymentInstructions: "Bank transfer to 12-3456" } });
    await call(o.cookie, "PUT", "/org/tax/profile", { country: "IN" });
    expect(doneOf(await status(o.cookie)).tax).toBe(false); // India needs the GST registration too
    await call(o.cookie, "PUT", "/org/tax/profile", { registrationNumber: "29AABFL0000B1ZA", stateCode: "29", legalName: "Harbour Plumbing" });
    await db.insert(accounts).values({ orgId: o.orgId, code: "6600", name: "Software", type: "expense" });
    const [bank] = await db.select({ id: moneyAccounts.id }).from(moneyAccounts).innerJoin(accounts, eq(accounts.id, moneyAccounts.accountId)).where(and(eq(moneyAccounts.orgId, o.orgId), eq(accounts.code, "1010")));
    await db.update(moneyAccounts).set({ name: "HDFC Current" }).where(eq(moneyAccounts.id, bank!.id));
    await setSetting(o.orgId, "document_layout", { invoice: { paperSize: "a4" } });
    await db.insert(numberSequences).values({ orgId: o.orgId, documentType: "invoice", prefix: "INV", padding: 4, nextValue: 120 });
    await setSetting(o.orgId, "invoice_reminders", { enabled: true, offsets: [3] });
    await call(o.cookie, "PUT", "/org/modules", { leadsMeetings: true, jobsField: true, approvals: true, recurring: true });
    await db.insert(openingBalances).values({ orgId: o.orgId, cutoverDate: "2026-04-01", lockedAt: new Date() });
    await joinAs(o.orgId, "staff");
    await joinAs(o.orgId, "field");

    expect(doneOf(await status(o.cookie))).toEqual({ business: true, tax: true, accounts: true, opening_balances: true, bank_accounts: true, payment_instructions: true, documents: true, numbering: true, reminders: true, modules: true, team: true, email, backups: null, field_app: true });
  }, 120_000);

  it("hides a card marked not needed, brings it back, and refuses an unknown card", async () => {
    const o = await owner();
    const hide = await call(o.cookie, "PUT", "/org/setup-status/reminders/hidden", { hidden: true });
    expect(hide.status).toBe(200);
    const hidden = (await hide.json()) as SetupStatus;
    expect(hidden.cards.find((c) => c.key === "reminders")).toMatchObject({ hidden: true });
    expect(setupProgress(hidden.cards)).toMatchObject({ total: 12, notNeeded: 1 });
    expect((await status(o.cookie)).cards.find((c) => c.key === "reminders")?.hidden).toBe(true);

    const back = (await (await call(o.cookie, "PUT", "/org/setup-status/reminders/hidden", { hidden: false })).json()) as SetupStatus;
    expect(back.cards.find((c) => c.key === "reminders")?.hidden).toBe(false);
    expect((await call(o.cookie, "PUT", "/org/setup-status/payroll/hidden", { hidden: true })).status).toBe(400);
  }, 120_000);

  it("leaves Field app out while Jobs & field is off", async () => {
    const o = await owner();
    await call(o.cookie, "PUT", "/org/modules", { leadsMeetings: true, jobsField: false, approvals: true, recurring: true });
    expect((await status(o.cookie)).cards.map((c) => c.key)).not.toContain("field_app");
  }, 120_000);

  it("is Owner-only, and the dashboard checklist counts what's left", async () => {
    const o = await owner();
    for (const role of ["staff", "field"] as const) {
      const p = await joinAs(o.orgId, role);
      expect((await call(p.cookie, "GET", "/org/setup-status")).status).toBe(403);
      expect((await call(p.cookie, "PUT", "/org/setup-status/team/hidden", { hidden: true })).status).toBe(403);
    }
    const checklist = (await (await call(o.cookie, "GET", "/dashboard/checklist")).json()) as { setupLeft: number };
    expect(checklist.setupLeft).toBe(setupProgress((await status(o.cookie)).cards).toDo);
  }, 120_000);

  it("says when demo data is loaded, and counts the demo's settings as they stand", async () => {
    const o = await owner();
    expect((await call(o.cookie, "POST", "/demo-data/seed", { country: "GB", industry: "trades" })).status).toBe(201);
    const s = await status(o.cookie);
    expect(s.demoLoaded).toBe(true);
    expect(doneOf(s)).toMatchObject({ business: true, tax: true, modules: true });
  }, 120_000);
});
