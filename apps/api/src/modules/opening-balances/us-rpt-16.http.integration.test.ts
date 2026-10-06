import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount, OpeningBalancesView } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, journalEntries, journalLines, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import type { BalanceSheetReport } from "../reports/reports.service";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-16 — cutover date and opening account balances; the difference sits in 3900; P17 re-posts on each save. Requires local Postgres. */
describe("US-RPT-16 · set a cutover date and enter opening account balances (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let code: Record<string, string>;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const balances = (cutoverDate: string, entries: [string, string, string][]) => ({
    cutoverDate,
    lines: entries.map(([c, debit, credit]) => ({ accountId: code[c], debit, credit })),
  });
  /** The live (not reversed) P17 entry's lines, by account code. */
  const p17 = async () => {
    const live = await db
      .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit, date: journalEntries.date })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.sourceType, "opening_balance"), isNull(journalEntries.reversedById)));
    return live;
  };

  async function join(who: Who, role: "staff" | "field") {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role !== "staff") return;
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of ["ledger.view", "banking.record", "banking.view"]) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"], [field, "field"]] as const) {
      const email = `us-rpt-16-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(staff, "staff");
    await join(field, "field");
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("first time: the cutover date defaults to the start of the financial year; receivables and payables are read-only", async () => {
    const view = await json<OpeningBalancesView>(await call(owner, "GET", "/opening-balances"));
    expect(view.status).toBe("not_started");
    expect(view.cutoverDate).toBe(`${new Date().getFullYear()}-01-01`);
    expect(view.accounts.find((a) => a.code === "3900")).toBeUndefined();
    expect(view.accounts.find((a) => a.code === "1100")!.fromDocuments).toEqual({ label: "From opening invoices", debit: "0", credit: "0" });
    expect(view.accounts.find((a) => a.code === "2000")!.fromDocuments!.label).toBe("From opening bills");
    expect(view.accounts.find((a) => a.code === "1010")!.fromDocuments).toBeNull();
  });

  it("saving posts P17 the day before the cutover date, with the difference in 3900", async () => {
    const view = await json<OpeningBalancesView>(
      await call(owner, "PUT", "/opening-balances", balances("2026-07-01", [["1010", "2148020", "0"], ["1500", "3600000", "0"], ["1510", "0", "960000"], ["2500", "0", "1500000"], ["3000", "0", "4000000"]])),
    );
    expect(view).toMatchObject({ status: "draft", cutoverDate: "2026-07-01", balancesAsOf: "2026-06-30", totalDebit: "5748020", totalCredit: "6460000", adjustment: "-711980" });
    expect(view.accounts.find((a) => a.code === "1510")).toMatchObject({ debit: "0", credit: "960000" });
    const lines = await p17();
    expect(lines.every((l) => l.date === "2026-06-30")).toBe(true);
    expect(lines.map((l) => [l.code, l.debit, l.credit]).sort()).toEqual(
      [["1010", 2148020n, 0n], ["1500", 3600000n, 0n], ["1510", 0n, 960000n], ["2500", 0n, 1500000n], ["3000", 0n, 4000000n], ["3900", 711980n, 0n]].sort(),
    );
    const sheet = await json<BalanceSheetReport>(await call(owner, "GET", "/reports/balance-sheet?asOf=2026-06-30"));
    expect(sheet.assets.find((a) => a.code === "1010")!.amount).toBe("2148020");
    expect(sheet.equity.find((a) => a.code === "3900")!.amount).toBe("-711980");
    expect(sheet.equity.find((a) => a.code === "3900")).toBeDefined();
  });

  it("saving again reverses the old entry and posts the new one", async () => {
    await json(await call(owner, "PUT", "/opening-balances", balances("2026-07-01", [["1010", "2148020", "0"], ["3000", "0", "2148020"]])));
    const lines = await p17();
    expect(lines.map((l) => [l.code, l.debit, l.credit]).sort()).toEqual([["1010", 2148020n, 0n], ["3000", 0n, 2148020n]].sort());
    const view = await json<OpeningBalancesView>(await call(owner, "GET", "/opening-balances"));
    expect(view.adjustment).toBe("0");
  });

  it("refuses receivables, payables, advances and 3900 on the grid", async () => {
    for (const c of ["1100", "2000", "2200"]) {
      const res = await call(owner, "PUT", "/opening-balances", balances("2026-07-01", [[c, "100", "0"]]));
      expect(res.status).toBe(400);
      expect(await message(res)).toMatch(/comes from opening invoices, bills and credits\. Enter those instead\.$/);
    }
    expect(await message(await call(owner, "PUT", "/opening-balances", balances("2026-07-01", [["3900", "100", "0"]])))).toBe("Opening Balance Adjustments takes the difference. Leave it empty.");
  });

  it("can't use a cutover date after documents already in Spine", async () => {
    const bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    await json(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code["6900"], amount: "1000", date: "2026-06-15" }));
    const res = await call(owner, "PUT", "/opening-balances", balances("2026-07-01", [["1010", "2148020", "0"], ["3000", "0", "2148020"]]));
    expect(res.status).toBe(400);
    expect(await message(res)).toBe("1 documents are dated before the cutover date. Pick a date on or before Jun 15, 2026, or move those documents.");
    // Moving the cutover date back is fine, and the entry moves with it.
    await json(await call(owner, "PUT", "/opening-balances", balances("2026-06-15", [["1010", "2148020", "0"], ["3000", "0", "2148020"]])));
    expect((await p17()).every((l) => l.date === "2026-06-14")).toBe(true);
  });

  it("Owner only: Staff (even with ledger rights) and Field get 403", async () => {
    for (const who of [staff, field]) {
      expect((await call(who, "GET", "/opening-balances")).status).toBe(403);
      expect((await call(who, "PUT", "/opening-balances", { cutoverDate: "2026-07-01", lines: [] })).status).toBe(403);
    }
  });
});
