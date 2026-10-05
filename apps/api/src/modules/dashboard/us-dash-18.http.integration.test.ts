import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { describeAttention, fieldSummary, type AttentionItem } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, expenseCategories, expenses, jobAssignments, jobs, member, milestones, payments, session as sessionTable, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

function addDays(date: string, days: number): Date {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * US-DASH-18 — a Field user's dashboard: milestones due within 7 days on
 * their assigned jobs and their rejected expenses in "Needs your
 * attention"; their jobs with customer, site and next milestone and no
 * money; a feed of non-financial events on their jobs only. Requires
 * local Postgres.
 */
describe("US-DASH-18 · a field dashboard of my day (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const today = orgClock().date;
  let marinaId: string;

  const get = async <T>(who: Who, path: string) => (await (await fetch(`${testApp.baseUrl}${path}`, { headers: { cookie: who.cookie } })).json()) as T;

  async function newUser(name: string): Promise<Who> {
    const email = `us-dash-18-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("Sarah Mendes"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(field, await newUser("Marcus Webb"));
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));

    const [customer] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: owner.userId }).returning();
    const job = (name: string, number: string) => ({ orgId, contactId: customer!.id, name, number, siteAddress: "48 Harbor Way, Portland, ME 04101", currency: "USD", contractValueAmount: 9_000_000n, createdByUserId: owner.userId });
    const [marina] = await db.insert(jobs).values(job("Marina office fit-out", `JOB-${randomUUID().slice(0, 4)}`)).returning();
    const [other] = await db.insert(jobs).values(job("Someone else's job", `JOB-${randomUUID().slice(0, 4)}`)).returning();
    marinaId = marina!.id;
    await db.insert(jobAssignments).values({ orgId, jobId: marina!.id, userId: field.userId });

    await db.insert(milestones).values([
      { orgId, jobId: marina!.id, name: "Mobilisation & site setup", sequence: 0, dueDate: addDays(today, 3) },
      { orgId, jobId: marina!.id, name: "Fit-out complete", sequence: 1, dueDate: addDays(today, 20) },
      { orgId, jobId: marina!.id, name: "Demolition", sequence: 2, status: "completed", completedAt: new Date(), completedByUserId: field.userId, dueDate: addDays(today, -2) },
      { orgId, jobId: other!.id, name: "Not mine", sequence: 0, dueDate: addDays(today, 1) },
      { orgId, jobId: other!.id, name: "Finished elsewhere", sequence: 1, status: "completed", completedAt: new Date(), completedByUserId: owner.userId },
    ]);

    const [fuel] = await db.insert(expenseCategories).values({ orgId, name: "Fuel" }).returning();
    await db.insert(expenses).values([
      { orgId, categoryId: fuel!.id, date: new Date(), currency: "USD", amount: 6400n, status: "rejected", reviewComment: "Receipt is unreadable — please retake the photo.", rejectedByUserId: owner.userId, rejectedAt: new Date(), submittedByUserId: field.userId },
      { orgId, categoryId: fuel!.id, date: new Date(), currency: "USD", amount: 19200n, status: "approved", submittedByUserId: field.userId },
      { orgId, categoryId: fuel!.id, date: new Date(), currency: "USD", amount: 5000n, status: "rejected", rejectedByUserId: owner.userId, rejectedAt: new Date(), submittedByUserId: owner.userId },
    ]);
    await db.insert(payments).values({ orgId, contactId: customer!.id, date: new Date(), currency: "USD", amount: 500000n, method: "bank_transfer", createdByUserId: owner.userId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("attention lists milestones due within 7 days on my jobs and my rejected expenses with the reason", async () => {
    const rows = await get<AttentionItem[]>(field, "/dashboard/attention");
    expect(rows.map((r) => [r.kind, r.count])).toEqual([
      ["milestones_due", 1],
      ["expenses_rejected", 1],
    ]);
    const milestone = describeAttention(rows[0]!, (m) => `$${Number(m) / 100}`, today);
    expect(milestone.detail).toBe("Mobilisation & site setup · Marina office fit-out");
    expect(milestone.action).toBe("Mark complete");
    const expense = describeAttention(rows[1]!, (m) => `$${(Number(m) / 100).toFixed(2)}`, today);
    expect(expense).toEqual({
      title: "Your expense was rejected",
      detail: "Fuel · $64.00 · “Receipt is unreadable — please retake the photo.” — Sarah Mendes",
      action: "Fix and resubmit",
    });
    expect(fieldSummary(1, rows.length)).toBe("1 job on your list · 2 things need you");
  });

  it("my jobs carry customer, site and next milestone, never money", async () => {
    const list = await get<Record<string, unknown>[]>(field, "/jobs?assignedToMe=true&status=active&include=next_milestone");
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id: marinaId,
      name: "Marina office fit-out",
      contactName: "Harborview Construction Co.",
      siteAddress: "48 Harbor Way, Portland, ME 04101",
      nextMilestone: { name: "Mobilisation & site setup", dueDate: addDays(today, 3).toISOString().slice(0, 10) },
    });
    expect(list[0]).not.toHaveProperty("contractValueAmount");
    expect(list[0]).not.toHaveProperty("costBudgetAmount");
  });

  it("the feed shows non-financial events on my jobs only", async () => {
    const feed = await get<{ type: string; message: string }[]>(field, "/dashboard/activity-feed");
    expect(feed.map((e) => e.type)).toEqual(["milestone_completed"]);
    expect(feed[0]!.message).toContain("Demolition");
    const ownerFeed = await get<{ type: string }[]>(owner, "/dashboard/activity-feed");
    expect(ownerFeed.map((e) => e.type)).toEqual(expect.arrayContaining(["payment_received", "milestone_completed"]));
  });
});
