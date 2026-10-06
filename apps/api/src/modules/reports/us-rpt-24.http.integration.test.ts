import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GeneralLedgerReport, ManualJournal } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-24 — the general ledger: opening balance, entries with a running balance, closing balance; Owner or ledger.view. Requires local Postgres. */
describe("US-RPT-24 · see the general ledger (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let code: Record<string, string>;
  const journals: ManualJournal[] = [];
  const owner: Who = { cookie: "", userId: "" };
  const reader: Who = { cookie: "", userId: "" };
  const other: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const gl = (who: Who, query: string) => call(who, "GET", `/reports/general-ledger?${query}`);

  async function join(who: Who, role: "staff" | "field", grants: string[] = []) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role !== "staff") return;
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [reader, "reader"], [other, "other"], [field, "field"]] as const) {
      const email = `us-rpt-24-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(reader, "staff", ["ledger.view"]);
    await join(other, "staff", ["reports.view_receivables"]);
    await join(field, "field");
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    for (const [date, reason, amount] of [
      ["2026-06-30", "Year-end accruals", "482000"],
      ["2026-08-31", "Depreciation for August", "105000"],
      ["2026-09-30", "Depreciation for September", "105000"],
    ] as const) {
      journals.push(await json<ManualJournal>(await call(owner, "POST", "/manual-journals", { date, reason, lines: [{ accountId: code["6900"], debit: amount, credit: "0" }, { accountId: code["1510"], debit: "0", credit: amount }] })));
    }
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("shows each account with activity: opening balance, one row per entry with a running balance, closing balance", async () => {
    const report = await json<GeneralLedgerReport>(await gl(owner, "from=2026-07-01&to=2026-09-30"));
    expect(report.totalAccounts).toBe(2);
    expect(report.accounts.map((a) => a.account.code)).toEqual(["1510", "6900"]);
    const expense = report.accounts.find((a) => a.account.code === "6900")!;
    expect(expense.openingBalance).toBe("482000");
    expect(expense.rows.map((r) => [r.date, r.label, r.href, r.description, r.debit, r.credit, r.balance])).toEqual([
      ["2026-08-31", `Journal ${journals[1]!.number}`, `/journals/${journals[1]!.id}`, "Depreciation for August", "105000", "0", "587000"],
      ["2026-09-30", `Journal ${journals[2]!.number}`, `/journals/${journals[2]!.id}`, "Depreciation for September", "105000", "0", "692000"],
    ]);
    expect(expense.closingBalance).toBe("692000");
    const depreciation = report.accounts.find((a) => a.account.code === "1510")!;
    expect([depreciation.openingBalance, depreciation.rows.at(-1)!.balance, depreciation.closingBalance]).toEqual(["-482000", "-692000", "-692000"]);
  });

  it("only the accounts picked show", async () => {
    const report = await json<GeneralLedgerReport>(await gl(owner, `from=2026-07-01&to=2026-09-30&accountIds=${code["6900"]}`));
    expect(report.accounts.map((a) => a.account.code)).toEqual(["6900"]);
  });

  it("hides accounts with no activity by default, and pages by account when they're included", async () => {
    const quiet = await json<GeneralLedgerReport>(await gl(owner, "from=2026-10-01&to=2026-10-31"));
    expect([quiet.totalAccounts, quiet.accounts]).toEqual([0, []]);
    const all = await json<GeneralLedgerReport>(await gl(owner, "from=2026-10-01&to=2026-10-31&includeInactive=true&pageSize=5&page=2"));
    expect(all.totalAccounts).toBe(Object.keys(code).length);
    expect(all.accounts).toHaveLength(5);
    expect(all.page).toBe(2);
    const carried = await json<GeneralLedgerReport>(await gl(owner, `from=2026-10-01&to=2026-10-31&includeInactive=true&accountIds=${code["6900"]}`));
    expect(carried.accounts[0]).toMatchObject({ openingBalance: "692000", rows: [], closingBalance: "692000" });
  });

  it("a member with ledger.view can read it; Staff without it and Field get 403", async () => {
    expect((await gl(reader, "from=2026-07-01&to=2026-09-30")).status).toBe(200);
    for (const who of [other, field]) expect((await gl(who, "from=2026-07-01&to=2026-09-30")).status).toBe(403);
  });

  it("refuses a date it can't read", async () => {
    expect((await gl(owner, "from=July&to=2026-09-30")).status).toBe(400);
  });
});
