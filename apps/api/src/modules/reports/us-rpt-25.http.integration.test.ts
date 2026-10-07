import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DayBookReport, ManualJournal, MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-25 — the day book: every entry in date order with its lines; filter by source; Owner or ledger.view. Requires local Postgres. */
describe("US-RPT-25 · see the day book (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let code: Record<string, string>;
  let journal: ManualJournal;
  let moneyInId: string;
  let bank: MoneyAccount;
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
  const book = (who: Who, query: string) => call(who, "GET", `/reports/day-book?${query}`);

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
      const email = `us-rpt-25-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(reader, "staff", ["ledger.view"]);
    await join(other, "staff", ["reports.view_receivables"]);
    await join(field, "field");
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    moneyInId = (await json<{ id: string }>(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: code["3000"], amount: "1000000", date: "2026-10-01" }))).id;
    journal = await json<ManualJournal>(
      await call(owner, "POST", "/manual-journals", { date: "2026-10-02", reason: "Depreciation for September", lines: [{ accountId: code["1510"], debit: "0", credit: "65000" }, { accountId: code["6900"], debit: "65000", credit: "0" }] }),
    );
    await json(await call(owner, "POST", "/manual-journals", { date: "2026-10-05", reason: "Outside the range", lines: [{ accountId: code["6900"], debit: "100", credit: "0" }, { accountId: code["1510"], debit: "0", credit: "100" }] }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("each entry in the range shows date, source, narration and its lines (debits first), in date order", async () => {
    const report = await json<DayBookReport>(await book(owner, "from=2026-10-01&to=2026-10-02"));
    expect(report.entries.map((e) => [e.date, e.sourceType, e.label])).toEqual([
      ["2026-10-01", "bank_transaction", "Money in"],
      ["2026-10-02", "manual_journal", `Journal ${journal.number}`],
    ]);
    const [moneyIn, jnl] = report.entries;
    expect(moneyIn!.href).toBe(`/banking/${bank.id}`);
    expect(moneyIn!.sourceId).toBe(moneyInId);
    expect(moneyIn!.lines.map((l) => [l.account.code, l.debit, l.credit])).toEqual([
      ["1010", "1000000", "0"],
      ["3000", "0", "1000000"],
    ]);
    expect(jnl!.href).toBe(`/journals/${journal.id}`);
    expect(jnl!.description).toBe("Depreciation for September");
    expect(jnl!.lines.map((l) => [l.account.code, l.debit, l.credit])).toEqual([
      ["6900", "65000", "0"],
      ["1510", "0", "65000"],
    ]);
  });

  it("Source narrows to one kind", async () => {
    const journals = await json<DayBookReport>(await book(owner, "from=2026-10-01&to=2026-10-02&sourceType=journal"));
    expect(journals.entries.map((e) => e.sourceType)).toEqual(["manual_journal"]);
    const banking = await json<DayBookReport>(await book(owner, "from=2026-10-01&to=2026-10-02&sourceType=banking"));
    expect(banking.entries.map((e) => e.sourceType)).toEqual(["bank_transaction"]);
    expect((await book(owner, "from=2026-10-01&to=2026-10-02&sourceType=nonsense")).status).toBe(400);
  });

  it("a member with ledger.view can read it; Staff without it and Field get 403", async () => {
    expect((await book(reader, "from=2026-10-01&to=2026-10-02")).status).toBe(200);
    for (const who of [other, field]) expect((await book(who, "from=2026-10-01&to=2026-10-02")).status).toBe(403);
  });
});
