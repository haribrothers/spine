import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ActivityFeedEntry } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, expenseCategories, expenses, jobs, member, milestones, payments, quoteEvents, quotes, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-DASH-19 — `GET /dashboard/activity-feed` rows carry `actor` (the
 * member, or the customer for their own action), `parts` with amounts
 * marked strong in the shared money format, and `groupCount` for one
 * quote viewed several times within 24 hours. Requires local Postgres.
 */
describe("US-DASH-19 · who did what in the activity feed (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const feed = async (who: Who, query = "") => (await (await fetch(`${testApp.baseUrl}/dashboard/activity-feed${query}`, { headers: { cookie: who.cookie } })).json()) as ActivityFeedEntry[];

  async function newUser(name: string): Promise<Who> {
    const email = `us-dash-19-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("Alex Morgan"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(field, await newUser("Marcus Webb"));
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));

    const [harborview] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: owner.userId }).returning();
    const [maple] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const [viewed] = await db.insert(quotes).values({ orgId, contactId: harborview!.id, status: "sent", number: "QUO-0004", currency: "USD", totalAmount: 51000n, createdByUserId: owner.userId }).returning();
    const [won] = await db.insert(quotes).values({ orgId, contactId: maple!.id, status: "accepted", number: "QUO-0002", currency: "USD", totalAmount: 1425000n, createdByUserId: owner.userId }).returning();
    const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000);
    await db.insert(quoteEvents).values([
      { orgId, quoteId: viewed!.id, type: "viewed", createdAt: ago(0.5) },
      { orgId, quoteId: viewed!.id, type: "viewed", createdAt: ago(2) },
      { orgId, quoteId: viewed!.id, type: "viewed", createdAt: ago(5) },
      { orgId, quoteId: won!.id, type: "accepted", createdAt: ago(1) },
    ]);
    await db.insert(payments).values({ orgId, contactId: maple!.id, date: new Date(), currency: "USD", amount: 500000n, method: "bank_transfer", createdByUserId: owner.userId });
    const [job] = await db.insert(jobs).values({ orgId, contactId: harborview!.id, name: "Marina office fit-out", currency: "USD", createdByUserId: owner.userId }).returning();
    await db.insert(milestones).values({ orgId, jobId: job!.id, name: "Mobilisation & site setup", status: "completed", completedAt: ago(3), completedByUserId: field.userId });
    const [travel] = await db.insert(expenseCategories).values({ orgId, name: "Travel" }).returning();
    await db.insert(expenses).values({ orgId, categoryId: travel!.id, date: new Date(), currency: "USD", amount: 8500n, submittedByUserId: owner.userId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("names the actor and bolds amounts", async () => {
    const rows = await feed(owner);
    const byType = (type: string) => rows.find((r) => r.type === type)!;

    expect(byType("payment_received")).toMatchObject({
      actor: { name: "Alex Morgan", kind: "member" },
      message: "Alex Morgan recorded a payment of $5,000.00 from Maple Ridge Developments",
      parts: [{ text: "recorded a payment of " }, { text: "$5,000.00", strong: true }, { text: " from Maple Ridge Developments" }],
    });
    expect(byType("quote_accepted")).toMatchObject({ actor: { name: "Maple Ridge Developments", kind: "customer" }, message: "Maple Ridge Developments accepted QUO-0002 · $14,250.00" });
    expect(byType("milestone_completed")).toMatchObject({ actor: { name: "Marcus Webb", kind: "member" }, message: "Marcus Webb completed Mobilisation & site setup on Marina office fit-out" });
    expect(byType("expense_submitted")).toMatchObject({ actor: { name: "Alex Morgan" }, message: "Alex Morgan submitted an expense · Travel · $85.00" });
  });

  it("folds one customer's repeat views of a quote within 24 hours into one row with the latest time", async () => {
    const views = (await feed(owner)).filter((r) => r.type === "quote_viewed");
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ actor: { name: "Harborview Construction Co.", kind: "customer" }, groupCount: 3, message: "Harborview Construction Co. viewed QUO-0004 · 3 times" });
    expect(Date.now() - Date.parse(views[0]!.occurredAt)).toBeLessThan(3_600_000);
  });

  it("keeps money out of a Field user's feed, and honours a limit", async () => {
    const types = new Set((await feed(field)).map((r) => r.type));
    for (const t of ["payment_received", "quote_viewed", "quote_accepted", "expense_submitted"]) expect(types.has(t)).toBe(false);
    expect(await feed(owner, "?limit=2")).toHaveLength(2);
  });
});
