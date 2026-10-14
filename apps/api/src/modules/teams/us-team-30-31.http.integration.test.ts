import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join as joinPath } from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CAPABILITIES, SECTION_OPEN_CAPABILITIES, type SearchResponse } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { addresses, catalogItems, contacts, expenseCategories, expenses, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-TEAM-30, US-TEAM-31 (D-235) — a section closed for every one of a
 * Staff member's Teams refuses its routes; pickers still list what forms
 * need; Expenses without "See everyone's expenses" is their own; search
 * leaves closed sections out. Requires local Postgres.
 */
describe("US-TEAM-30 · US-TEAM-31 · sections a Team can open (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let contactId: string;
  let categoryId: string;
  const owner: Who = { cookie: "", userId: "" };
  const closed: Who = { cookie: "", userId: "" };
  const open: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, path: string, init: RequestInit = {}) =>
    fetch(`${testApp.baseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie, ...(init.headers ?? {}) } });
  const get = async <T>(who: Who, path: string) => (await (await call(who, path)).json()) as T;

  async function newUser(name: string): Promise<Who> {
    const email = `us-team-30-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function join(who: Who, role: "staff" | "field", grants: string[]) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role === "field") return;
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values(grants.map((capability) => ({ teamId: team!.id, capability, granted: true })));
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  const CLOSED = ["contacts.open", "catalog.open", "jobs.open", "quotes.open", "expenses.view_others"];
  const closedSection = (c: string) => CLOSED.some((x) => c.split(".")[0] === x.split(".")[0]) && !c.startsWith("expenses.");

  async function expense(who: Who) {
    const [row] = await db.insert(expenses).values({ orgId, categoryId, date: new Date(), currency: "USD", amount: 6400n, submittedByUserId: who.userId }).returning();
    return row!.id;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harbourview Apartments", email: "accounts@harbourview.test", notes: "Gate code 4411", stateCode: "29", createdByUserId: owner.userId }).returning();
    contactId = contact!.id;
    await db.insert(addresses).values({ contactId, type: "site", line1: "12 Marina Road", city: "Bengaluru", stateCode: "29", isPrimary: true });
    await db.insert(catalogItems).values({ orgId, name: "Kitchen cabinet install", unit: "each", defaultPriceAmount: 120000n, defaultPriceCurrency: "INR", createdByUserId: owner.userId });
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel & freight" }).returning();
    categoryId = category!.id;
    const job = (await (await call(owner, "/jobs", { method: "POST", body: JSON.stringify({ contactId, name: "Harbourview kitchen refit", currency: "INR" }) })).json()) as { id: string };
    expect(job.id).toBeTruthy();

    // Contacts, Catalogue, Jobs and Quotes closed; everyone's expenses off. Their actions go with them.
    Object.assign(closed, await newUser("closed"));
    const granted = CAPABILITIES.filter((c) => !CLOSED.includes(c) && !closedSection(c) && !["expenses.edit_others", "expenses.delete_others", "expenses.approve", "expenses.reject", "expenses.mark_billed", "expenses.bill_to_customer"].includes(c));
    // "contacts.edit_own" stands for a grant left behind (never through the Team page, which turns it off with Open).
    await join(closed, "staff", [...granted, "contacts.edit_own"]);
    Object.assign(open, await newUser("open"));
    await join(open, "staff", [...CAPABILITIES]);
    Object.assign(field, await newUser("field"));
    await join(field, "field", []);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("US-TEAM-30: a closed section refuses its lists, records, history and actions with 403", async () => {
    for (const path of ["/contacts", `/contacts/${contactId}`, `/contacts/${contactId}/history`, "/catalog-items", "/catalog-bundles", "/jobs", "/quotes"]) {
      expect((await call(closed, path)).status, path).toBe(403);
    }
    // Even with a create permission the Team somehow kept, the section stays shut.
    expect((await call(closed, "/contacts", { method: "POST", body: JSON.stringify({ type: "customer", name: "New customer" }) })).status).toBe(403);
    // Open sections still answer.
    expect((await call(closed, "/invoices")).status).toBe(200);
    expect((await call(closed, "/vendor-bills")).status).toBe(200);
    // Owners, Staff with it open, and Field (their fixed sections) are unaffected.
    expect((await call(owner, "/quotes")).status).toBe(200);
    expect((await call(open, "/contacts")).status).toBe(200);
    expect((await call(field, "/jobs")).status).toBe(200);
  });

  it("US-TEAM-30: without “See everyone's expenses”, Staff see and open their own only", async () => {
    const mine = await expense(closed);
    const theirs = await expense(owner);
    expect((await get<{ id: string }[]>(closed, "/expenses")).map((e) => e.id)).toEqual([mine]);
    expect((await call(closed, `/expenses/${theirs}`)).status).toBe(404);
    expect((await call(closed, `/expenses/${mine}`)).status).toBe(200);
    const all = (await get<{ id: string }[]>(open, "/expenses")).map((e) => e.id);
    expect(all).toEqual(expect.arrayContaining([mine, theirs]));
  });

  it("US-TEAM-31: pickers list contacts, items and jobs with only what forms need", async () => {
    const people = await get<Record<string, unknown>[]>(closed, "/contacts?picker=1");
    expect(people.map((p) => p.name)).toContain("Harbourview Apartments");
    expect(people[0]).not.toHaveProperty("notes");
    expect(people[0]).toMatchObject({ id: contactId, type: "customer", email: "accounts@harbourview.test", stateCode: "29" });

    const one = await get<Record<string, unknown> & { addresses: { line1: string }[] }>(closed, `/contacts/${contactId}?picker=1`);
    expect(one).not.toHaveProperty("notes");
    expect(one.addresses.map((a) => a.line1)).toEqual(["12 Marina Road"]);

    const items = await get<Record<string, unknown>[]>(closed, "/catalog-items?picker=1");
    expect(items[0]).toMatchObject({ name: "Kitchen cabinet install", unit: "each" });
    expect(items[0]).not.toHaveProperty("createdByUserId");

    const jobs = await get<Record<string, unknown>[]>(closed, "/jobs?picker=1");
    expect(jobs.map((j) => j.name)).toEqual(["Harbourview kitchen refit"]);
    expect(Object.keys(jobs[0]!).sort()).toEqual(["contactId", "contactName", "id", "name", "number", "status"]);

    // A record route that isn't a picker stays shut, picker or not.
    expect((await call(closed, `/contacts/${contactId}/history?picker=1`)).status).toBe(403);
    // With the section open, a picker gets the full rows.
    expect((await get<Record<string, unknown>[]>(open, "/contacts?picker=1"))[0]).toHaveProperty("notes", "Gate code 4411");
  });

  it("US-TEAM-31: search leaves closed sections out", async () => {
    const forClosed = await get<SearchResponse>(closed, "/search?q=Harbourview");
    expect(forClosed.groups.map((g) => g.type)).not.toContain("contacts");
    expect(forClosed.groups.map((g) => g.type)).not.toContain("jobs");
    const forOpen = await get<SearchResponse>(open, "/search?q=Harbourview");
    expect(forOpen.groups.map((g) => g.type)).toEqual(expect.arrayContaining(["contacts", "jobs"]));
  });

  // Last: the migration opens every Team in the database, this file's closed one too.
  it("US-TEAM-30: migration 0123 opens every section for a Team that existed before, and keeps a closed one closed", async () => {
    const [before] = await db.insert(teams).values({ orgId, name: `Before ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: before!.id, capability: "quotes.open", granted: false });
    await db.execute(sql.raw(readFileSync(joinPath(__dirname, "../../../drizzle/0123_team_open_sections.sql"), "utf8")));
    const rows = await db.select().from(teamPrivileges).where(and(eq(teamPrivileges.teamId, before!.id), eq(teamPrivileges.granted, true)));
    expect(rows.map((r) => r.capability).sort()).toEqual(SECTION_OPEN_CAPABILITIES.map((o) => o.capability).filter((c) => c !== "quotes.open").sort());
  });
});
