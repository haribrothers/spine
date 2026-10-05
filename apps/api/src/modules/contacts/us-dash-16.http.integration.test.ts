import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { activities, contacts, leads, leadStages, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-DASH-16 — `GET /activities/overdue?includeToday=true` feeds the
 * dashboard's "Today" card: my open follow-ups due before the end of
 * today (not just before now), each with the contact's name. Requires
 * local Postgres.
 */
describe("US-DASH-16 · follow-ups due today or overdue (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };

  const overdue = async (query = "") =>
    (await (await fetch(`${testApp.baseUrl}/activities/overdue${query}`, { headers: { cookie: owner.cookie } })).json()) as { id: string; notes: string; contactName: string | null }[];

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-dash-16-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(owner, await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Alex Morgan" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;

    const [harborview] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: owner.userId }).returning();
    const [maple] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const [stage] = await db.select().from(leadStages).where(eq(leadStages.orgId, orgId)).limit(1);
    const [lead] = await db.insert(leads).values({ orgId, contactId: maple!.id, stageId: stage!.id, valueCurrency: "USD", title: "Lobby refit", createdByUserId: owner.userId }).returning();

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 0, 0);
    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date();
    tomorrow.setHours(24, 30, 0, 0);
    const base = { orgId, type: "call" as const, assignedToUserId: owner.userId, createdByUserId: owner.userId };
    await db.insert(activities).values([
      { ...base, contactId: harborview!.id, notes: "Call back Priya Nair", dueAt: yesterday },
      { ...base, leadId: lead!.id, notes: "Send revised drawings", dueAt: endOfToday },
      { ...base, contactId: harborview!.id, notes: "Tomorrow's call", dueAt: tomorrow },
      { ...base, contactId: harborview!.id, notes: "Already done", dueAt: yesterday, doneAt: new Date() },
    ]);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("without includeToday, lists only follow-ups already past due, with the contact's name", async () => {
    const rows = await overdue();
    expect(rows.map((r) => [r.notes, r.contactName])).toEqual([["Call back Priya Nair", "Harborview Construction Co."]]);
  });

  it("with includeToday, adds the rest of today's, naming a lead's contact, but not tomorrow's", async () => {
    const rows = await overdue("?includeToday=true");
    expect(rows.map((r) => [r.notes, r.contactName])).toEqual([
      ["Call back Priya Nair", "Harborview Construction Co."],
      ["Send revised drawings", "Maple Ridge Developments"],
    ]);
  });
});
