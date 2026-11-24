import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Kpi } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { orgClock } from "../../common/org-clock";

type Who = { cookie: string; userId: string };

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** US-DASH-21 — the payables figure on the dashboard: current, overdue, due this week, oldest overdue; gated by reports.view_payables. Requires local Postgres. */
describe("US-DASH-21 · see what I owe vendors on the dashboard (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const apStaff: Who = { cookie: "", userId: "" };
  const plainStaff: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  async function join(who: Who, grants: string[]) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [apStaff, "ap"], [plainStaff, "plain"]] as const) {
      const email = `us-dash-21-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(apStaff, ["reports.view_payables"]);
    await join(plainStaff, ["reports.view_receivables"]);
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    const today = orgClock().date;
    for (const [billNumber, amount, dueIn] of [
      ["GSC-8834", "107861", -7],
      ["GSC-8840", "30000", -2],
      ["GSC-8900", "244900", 3],
      ["GSC-8950", "338779", 30],
    ] as const) {
      const bill = await json<{ id: string }>(
        await call(owner, "POST", "/vendor-bills", {
          contactId: vendor!.id,
          billNumber,
          date: shift(today, -40),
          dueDate: shift(today, dueIn),
          currency: "USD",
          lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: amount, accountId: code["5000"] }],
        }),
      );
      await json(await call(owner, "POST", `/vendor-bills/${bill.id}/record`));
    }
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("shows total payables split current and overdue, bills due in the next 7 days and the oldest overdue", async () => {
    const payables = (await json<Kpi[]>(await call(owner, "GET", "/dashboard/kpis"))).find((k) => k.key === "payables")!;
    expect(payables.value).toBe("721540");
    expect(payables.detail).toMatchObject({ current: "583679", overdue: "137861", dueSoon: { count: 1, amount: "244900" }, oldestOverdue: { number: "GSC-8834", days: 7 } });
    expect(payables.series).toHaveLength(8);
  });

  it("a member with 'View payables' gets it; without it, it isn't there", async () => {
    expect((await json<Kpi[]>(await call(apStaff, "GET", "/dashboard/kpis"))).some((k) => k.key === "payables")).toBe(true);
    expect((await json<Kpi[]>(await call(plainStaff, "GET", "/dashboard/kpis"))).some((k) => k.key === "payables")).toBe(false);
  });
});
