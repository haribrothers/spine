import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { describeAttention, type AttentionItem, type Kpi } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import {
  activities,
  contacts,
  expenseCategories,
  expenses,
  leads,
  leadStages,
  member,
  quotes,
  session as sessionTable,
  teamMemberships,
  teamPrivileges,
  teams,
  user,
} from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

function addDays(date: string, days: number): Date {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * US-DASH-17 — a Staff user's dashboard is built from their own work and
 * their Team's grants: their own overdue follow-ups and expiring quotes in
 * "Needs your attention", never their own expense to approve (D-085), and
 * without `reports.view_dashboard_summary` the KPI row is receivables and
 * overdue (with `reports.view_receivables`), open pipeline and quotes won
 * this month. Requires local Postgres.
 */
describe("US-DASH-17 · a staff dashboard of only what I can act on (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const summaryStaff: Who = { cookie: "", userId: "" };
  const plainStaff: Who = { cookie: "", userId: "" };
  const today = orgClock().date;

  const get = async <T>(who: Who, path: string) => (await (await fetch(`${testApp.baseUrl}${path}`, { headers: { cookie: who.cookie } })).json()) as T;

  async function newUser(name: string): Promise<Who> {
    const email = `us-dash-17-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function join(who: Who, grants: string[]) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    if (grants.length) await db.insert(teamPrivileges).values(grants.map((capability) => ({ teamId: team!.id, capability, granted: true })));
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("Alex Morgan"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(staff, await newUser("Sarah Mendes"));
    await join(staff, ["quotes.open", "expenses.view_others", "expenses.approve", "reports.view_receivables"]);
    Object.assign(summaryStaff, await newUser("Summary Staff"));
    await join(summaryStaff, ["reports.view_dashboard_summary"]);
    Object.assign(plainStaff, await newUser("Plain Staff"));
    await join(plainStaff, []);

    const [customer] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: owner.userId }).returning();

    // Sarah's own expense waits for approval; she must not see it (D-085).
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel" }).returning();
    await db.insert(expenses).values({ orgId, categoryId: category!.id, date: new Date(), currency: "USD", amount: 6400n, submittedByUserId: staff.userId });

    // Quotes expiring: Sarah's and the Owner's.
    await db.insert(quotes).values([
      { orgId, contactId: customer!.id, status: "sent", number: "QUO-0004", currency: "USD", totalAmount: 51000n, validUntil: addDays(today, 3), createdByUserId: staff.userId },
      { orgId, contactId: customer!.id, status: "sent", number: "QUO-0005", currency: "USD", totalAmount: 99000n, validUntil: addDays(today, 2), createdByUserId: owner.userId },
    ]);
    // Two won this month.
    await db.insert(quotes).values([
      { orgId, contactId: customer!.id, status: "accepted", number: "QUO-0002", currency: "USD", totalAmount: 1425000n, respondedAt: new Date(), createdByUserId: owner.userId },
      { orgId, contactId: customer!.id, status: "accepted", number: "QUO-0003", currency: "USD", totalAmount: 42200n, respondedAt: new Date(), createdByUserId: owner.userId },
    ]);

    // Sarah's overdue follow-ups, and one of the Owner's.
    const yesterday = new Date(Date.now() - 86_400_000);
    const base = { orgId, type: "call" as const, contactId: customer!.id, dueAt: yesterday, createdByUserId: owner.userId };
    await db.insert(activities).values([
      { ...base, assignedToUserId: staff.userId, notes: "Call back Priya Nair" },
      { ...base, assignedToUserId: staff.userId, notes: "Send revised drawings to Maple Ridge", dueAt: new Date(Date.now() - 3_600_000) },
      { ...base, assignedToUserId: owner.userId, notes: "Owner's own call" },
    ]);

    // Pipeline: two open leads and one won.
    const stages = await db.select().from(leadStages).where(eq(leadStages.orgId, orgId));
    const open = stages.find((s) => s.kind === "open")!;
    const won = stages.find((s) => s.kind === "won")!;
    await db.insert(leads).values([
      { orgId, contactId: customer!.id, stageId: open.id, valueAmount: 3410500n, valueCurrency: "USD", createdByUserId: owner.userId },
      { orgId, contactId: customer!.id, stageId: open.id, valueAmount: 6140000n, valueCurrency: "USD", createdByUserId: owner.userId },
      { orgId, contactId: customer!.id, stageId: won.id, valueAmount: 42200n, valueCurrency: "USD", createdByUserId: owner.userId },
    ]);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("Staff's attention has only what they can act on: no own expense, their own follow-ups and quotes", async () => {
    const rows = await get<AttentionItem[]>(staff, "/dashboard/attention");
    expect(rows.map((r) => r.kind)).toEqual(["quotes_expiring", "followups_overdue"]);

    const quote = rows[0]!;
    expect(quote).toMatchObject({ count: 1, mine: true });
    expect(quote.items[0]!.number).toBe("QUO-0004");
    expect(describeAttention(quote, (m) => m, today).title).toMatch(/^Your quote QUO-0004 expires /);

    const followups = rows[1]!;
    expect(followups.count).toBe(2);
    expect(followups.items.map((i) => i.name)).toEqual(["Call back Priya Nair", "Send revised drawings to Maple Ridge"]);
    expect(followups.items[0]).toMatchObject({ party: "Harborview Construction Co.", contactId: expect.any(String) });
    expect(describeAttention(followups, (m) => m, today)).toMatchObject({
      title: "2 follow-ups are overdue",
      detail: "Call back Priya Nair · Send revised drawings to Maple Ridge",
      action: "Open",
    });

    // The Owner's own follow-ups don't make a row for them; their quotes aren't "mine".
    const forOwner = await get<AttentionItem[]>(owner, "/dashboard/attention");
    expect(forOwner.map((r) => r.kind)).not.toContain("followups_overdue");
    expect(forOwner.find((r) => r.kind === "quotes_expiring")).toMatchObject({ count: 2 });
    expect(forOwner.find((r) => r.kind === "quotes_expiring")!.mine).toBeUndefined();
  });

  it("without the dashboard-summary grant, Staff's KPIs are receivables, overdue, open pipeline and quotes won", async () => {
    const kpis = await get<Kpi[]>(staff, "/dashboard/kpis");
    expect(kpis.map((k) => [k.key, k.label])).toEqual([
      ["receivables", "Receivables"],
      ["overdue", "Overdue"],
      ["pipeline", "Open pipeline"],
      ["quotes_won", "Quotes won this month"],
    ]);
    expect(kpis[2]).toMatchObject({ format: "money", value: "9550500" });
    expect(kpis[2]!.series).toHaveLength(8);
    expect(kpis[3]).toMatchObject({ format: "count", value: "2", detail: { amount: "1467200" } });
  });

  it("follows the grants held: no receivables grant, no receivables figures; the summary grant gets the Owner's set", async () => {
    expect((await get<Kpi[]>(plainStaff, "/dashboard/kpis")).map((k) => k.key)).toEqual(["pipeline", "quotes_won"]);
    expect((await get<Kpi[]>(summaryStaff, "/dashboard/kpis")).map((k) => k.key)).toEqual(["cash", "profit", "receivables", "overdue"]);
    // US-DASH-21 — Owners hold "View payables" too.
    expect((await get<Kpi[]>(owner, "/dashboard/kpis")).map((k) => k.key)).toEqual(["cash", "profit", "receivables", "overdue", "payables"]);
  });

  it("a closed lead stays out of the pipeline", async () => {
    const [lead] = await db.select().from(leads).where(and(eq(leads.orgId, orgId), eq(leads.valueAmount, 3410500n)));
    const lost = (await db.select().from(leadStages).where(eq(leadStages.orgId, orgId))).find((s) => s.kind === "lost")!;
    await db.update(leads).set({ stageId: lost.id }).where(eq(leads.id, lead!.id));
    const kpis = await get<Kpi[]>(plainStaff, "/dashboard/kpis");
    expect(kpis[0]!.value).toBe("6140000");
  });
});
