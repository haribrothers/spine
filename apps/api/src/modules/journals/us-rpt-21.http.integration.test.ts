import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ManualJournal, MoneyAccount, ReconciliationView } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, journalEntries, journalLines, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-21 — reverse a journal: a mirror entry, the reason kept; refused when reconciled or already reversed. Requires local Postgres. */
describe("US-RPT-21 · reverse a journal posted by mistake (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let code: Record<string, string>;
  const owner: Who = { cookie: "", userId: "" };
  const viewer: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const post = (lines: [string, string, string][], date = "2026-09-30") =>
    call(owner, "POST", "/manual-journals", { date, reason: "Depreciation for September", lines: lines.map(([c, debit, credit]) => ({ accountId: code[c], debit, credit })) });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [viewer, "viewer"]] as const) {
      const email = `us-rpt-21-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, viewer.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: viewer.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, viewer.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "ledger.view", granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("reversing posts a mirror entry on the chosen date and keeps the journal with its reason", async () => {
    const journal = await json<ManualJournal>(await post([["6900", "65000", "0"], ["1500", "0", "65000"]]));
    const reversed = await json<ManualJournal>(await call(owner, "POST", `/manual-journals/${journal.id}/reverse`, { date: "2026-10-03", reason: "Wrong account: should have been 1510" }));
    expect(reversed).toMatchObject({ status: "reversed", reversal: { date: "2026-10-03", reason: "Wrong account: should have been 1510", by: { name: "owner" } } });
    const [entry] = await db.select().from(journalEntries).where(and(eq(journalEntries.sourceType, "manual_journal_reversal"), eq(journalEntries.sourceId, journal.id)));
    expect(entry).toMatchObject({ date: "2026-10-03", narration: `Journal ${journal.number} reversed — Wrong account: should have been 1510` });
    const lines = await db.select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit }).from(journalLines).innerJoin(accounts, eq(accounts.id, journalLines.accountId)).where(eq(journalLines.entryId, entry!.id));
    expect(lines.map((l) => [l.code, l.debit, l.credit]).sort()).toEqual([["1500", 65000n, 0n], ["6900", 0n, 65000n]].sort());
    expect(await message(await call(owner, "POST", `/manual-journals/${journal.id}/reverse`, { date: "2026-10-03", reason: "again" }))).toBe("This journal is already reversed.");
  });

  it("a reversal date inside a closed period is refused", async () => {
    const journal = await json<ManualJournal>(await post([["6900", "100", "0"], ["1510", "0", "100"]], "2026-09-15"));
    const period = await json<{ id: string }>(await call(owner, "POST", "/org/fiscal-periods", { startDate: "2026-01-01", endDate: "2026-06-30" }));
    await json(await call(owner, "POST", `/org/fiscal-periods/${period.id}/close`));
    expect(await message(await call(owner, "POST", `/manual-journals/${journal.id}/reverse`, { date: "2026-06-30", reason: "x" }))).toMatch(/falls within a closed fiscal period/);
  });

  it("a journal on a reconciled bank line gets the reconciliation message", async () => {
    const bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const journal = await json<ManualJournal>(await post([["1010", "25000", "0"], ["3000", "0", "25000"]], "2026-10-01"));
    const form = new FormData();
    form.append("file", new Blob(["Date,Description,Amount\n2026-10-01,CAPITAL,250.00\n"], { type: "text/csv" }), "s.csv");
    form.append("mapping", JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" }));
    await json(await fetch(`${testApp.baseUrl}/money-accounts/${bank.id}/statement-imports`, { method: "POST", headers: { "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: form }));
    const view = await json<ReconciliationView>(await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: "2026-10-01", statementClosingBalance: "25000" }));
    await json(await call(owner, "PUT", `/bank-reconciliations/${view.id}/matches`, { matches: [{ statementLineId: view.statementLines[0]!.id, journalLineIds: [view.entries.find((e) => e.sourceId === journal.id)!.journalLineId] }] }));
    await json(await call(owner, "POST", `/bank-reconciliations/${view.id}/finish`));
    const res = await call(owner, "POST", `/manual-journals/${journal.id}/reverse`, { date: "2026-10-03", reason: "Wrong" });
    expect(res.status).toBe(400);
    expect(await message(res)).toBe("This entry is part of a finished reconciliation of Bank Account to Oct 1, 2026. Undo that reconciliation first.");
  });

  it("Staff with ledger.view can read but not reverse", async () => {
    const list = await json<ManualJournal[]>(await call(viewer, "GET", "/manual-journals"));
    expect(list.length).toBeGreaterThan(0);
    expect((await call(viewer, "POST", `/manual-journals/${list[0]!.id}/reverse`, { date: "2026-10-03", reason: "x" })).status).toBe(403);
  });
});
