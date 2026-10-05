import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyInOutReport } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, journalEntries, journalLines, member, session as sessionTable, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** The first day of the month `back` months before today's, `YYYY-MM-DD`. */
function monthStart(today: string, back: number): string {
  return new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - back, 1)).toISOString().slice(0, 10);
}

/**
 * US-DASH-15 — `GET /reports/money-in-out`: per month, what came into and
 * went out of the cash and bank accounts, from journal lines (D-011). A
 * transfer between cash and bank counts as neither. Requires local
 * Postgres.
 */
describe("US-DASH-15 · see money in and out by month (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const today = orgClock().date;
  const thisMonth = today.slice(0, 7);
  const lastMonth = monthStart(today, 1).slice(0, 7);
  const fourMonthsAgo = monthStart(today, 4);

  const get = (who: Who, months?: number) => fetch(`${testApp.baseUrl}/reports/money-in-out${months ? `?months=${months}` : ""}`, { headers: { cookie: who.cookie } });

  async function newUser(name: string): Promise<Who> {
    const email = `us-dash-15-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function account(code: string): Promise<string> {
    const [row] = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, code)));
    return row!.id;
  }

  async function post(date: string, lines: { accountId: string; debit: bigint; credit: bigint }[]) {
    await db.transaction(async (tx) => {
      const id = randomUUID();
      await tx.insert(journalEntries).values({ id, orgId, date, sourceType: "test", sourceId: randomUUID() });
      await tx.insert(journalLines).values(lines.map((l) => ({ entryId: id, ...l })));
    });
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
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("before any payment or bill, every month is zero and the card knows there's nothing yet", async () => {
    const report = (await (await get(owner)).json()) as MoneyInOutReport;
    expect(report.months).toHaveLength(12);
    expect(report.months.at(-1)!.month).toBe(thisMonth);
    expect(report).toMatchObject({ totalIn: "0", totalOut: "0", net: "0", hasActivity: false });
  });

  it("puts each month's money in and money out side by side, with totals and net", async () => {
    const [cash, bank, receivable, payable, sales] = (await Promise.all(["1000", "1010", "1100", "2000", "4000"].map(account))) as [string, string, string, string, string];
    // A customer payment into the bank this month: in.
    await post(today, [
      { accountId: bank, debit: 500000n, credit: 0n },
      { accountId: receivable, debit: 0n, credit: 500000n },
    ]);
    // A vendor bill paid from the bank this month: out.
    await post(today, [
      { accountId: payable, debit: 120000n, credit: 0n },
      { accountId: bank, debit: 0n, credit: 120000n },
    ]);
    // A cash sale last month: in.
    await post(monthStart(today, 1), [
      { accountId: cash, debit: 30000n, credit: 0n },
      { accountId: sales, debit: 0n, credit: 30000n },
    ]);
    // Moving cash to the bank: neither in nor out.
    await post(today, [
      { accountId: bank, debit: 20000n, credit: 0n },
      { accountId: cash, debit: 0n, credit: 20000n },
    ]);
    // Four months ago: out, only inside a 6- or 12-month range.
    await post(fourMonthsAgo, [
      { accountId: payable, debit: 900000n, credit: 0n },
      { accountId: bank, debit: 0n, credit: 900000n },
    ]);

    const year = (await (await get(owner)).json()) as MoneyInOutReport;
    expect(year.months.find((m) => m.month === thisMonth)).toEqual({ month: thisMonth, in: "500000", out: "120000" });
    expect(year.months.find((m) => m.month === lastMonth)).toEqual({ month: lastMonth, in: "30000", out: "0" });
    expect(year).toMatchObject({ totalIn: "530000", totalOut: "1020000", net: "-490000", hasActivity: true });

    const quarter = (await (await get(owner, 3)).json()) as MoneyInOutReport;
    expect(quarter.months.map((m) => m.month)).toEqual([monthStart(today, 2).slice(0, 7), lastMonth, thisMonth]);
    expect(quarter).toMatchObject({ totalIn: "530000", totalOut: "120000", net: "410000" });

    const half = (await (await get(owner, 6)).json()) as MoneyInOutReport;
    expect(half.months).toHaveLength(6);
    expect(half.totalOut).toBe("1020000");
  });

  it("Field users can't read it", async () => {
    expect((await get(field)).status).toBe(403);
  });
});
