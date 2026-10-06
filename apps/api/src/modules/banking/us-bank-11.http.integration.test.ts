import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount, ReconciliationSummary, ReconciliationView } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, auditLog, journalLines, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-BANK-11 — the history of finished reconciliations; only the latest can be undone. Requires local Postgres. */
describe("US-BANK-11 · review or undo a reconciliation (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let code: Record<string, string>;
  const recs: string[] = [];
  const owner: Who = { cookie: "", userId: "" };
  const viewer: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const reconciledCount = async () => (await db.select({ id: journalLines.id }).from(journalLines).where(and(eq(journalLines.accountId, bank.accountId), isNotNull(journalLines.reconciliationId)))).length;

  /** One month: money in on the 10th, a statement line for it, reconciled to the month end. */
  async function reconcileMonth(month: string, amount: string, closing: string) {
    const entry = await json<{ id: string }>(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: code["3000"], amount, date: `${month}-10` }));
    const form = new FormData();
    form.append("file", new Blob([`Date,Description,Amount\n${month}-10,CAPITAL ${month},${(Number(amount) / 100).toFixed(2)}\n`], { type: "text/csv" }), `statement-${month}.csv`);
    form.append("mapping", JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" }));
    await json(await fetch(`${testApp.baseUrl}/money-accounts/${bank.id}/statement-imports`, { method: "POST", headers: { "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: form }));
    const view = await json<ReconciliationView>(await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: `${month}-28`, statementClosingBalance: closing }));
    const line = view.statementLines[0]!;
    const journalLineId = view.entries.find((e) => e.sourceId === entry.id)!.journalLineId;
    await json(await call(owner, "PUT", `/bank-reconciliations/${view.id}/matches`, { matches: [{ statementLineId: line.id, journalLineIds: [journalLineId] }] }));
    await json(await call(owner, "POST", `/bank-reconciliations/${view.id}/finish`));
    recs.push(view.id);
  }

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
    for (const [who, name] of [[owner, "owner"], [viewer, "viewer"], [field, "field"]] as const) {
      const email = `us-bank-11-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(viewer, "staff", ["banking.view", "banking.record"]);
    await join(field, "field");
    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    await reconcileMonth("2026-07", "100000", "100000");
    await reconcileMonth("2026-08", "50000", "150000");
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("lists finished reconciliations, newest first, with who finished them", async () => {
    const list = await json<ReconciliationSummary[]>(await call(owner, "GET", `/money-accounts/${bank.id}/reconciliations`));
    expect(list.map((r) => [r.statementEndDate, r.statementClosingBalance, r.entriesMatched, r.finishedBy?.name, r.isLatest])).toEqual([
      ["2026-08-28", "150000", 1, "owner", true],
      ["2026-07-28", "100000", 1, "owner", false],
    ]);
    expect(list[0]!.finishedAt).toEqual(expect.any(String));
  });

  it("an older one can't be undone first", async () => {
    const res = await call(owner, "POST", `/bank-reconciliations/${recs[0]}/undo`);
    expect(res.status).toBe(400);
    expect(await message(res)).toBe("Undo the later reconciliations first.");
  });

  it("undoing the latest takes the tick off its entries and unmatches its lines; nothing is deleted", async () => {
    expect(await reconciledCount()).toBe(2);
    const undone = await json<ReconciliationSummary>(await call(owner, "POST", `/bank-reconciliations/${recs[1]}/undo`));
    expect(undone.status).toBe("undone");
    expect(await reconciledCount()).toBe(1);
    const lines = await json<{ description: string; status: string }[]>(await call(owner, "GET", `/money-accounts/${bank.id}/statement-lines`));
    expect(lines.map((l) => [l.description, l.status])).toEqual([
      ["CAPITAL 2026-07", "matched"],
      ["CAPITAL 2026-08", "unmatched"],
    ]);
    const list = await json<ReconciliationSummary[]>(await call(owner, "GET", `/money-accounts/${bank.id}/reconciliations`));
    expect(list.map((r) => [r.statementEndDate, r.isLatest])).toEqual([["2026-07-28", true]]);
    expect((await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.id === bank.id)!.lastReconciledOn).toBe("2026-07-28");
    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, recs[1]!), eq(auditLog.action, "undone")));
    expect(audit?.entityType).toBe("bank_reconciliation");

    // It can be reconciled again.
    const again = await json<ReconciliationView>(await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: "2026-08-28", statementClosingBalance: "150000" }));
    expect(again.statementLines.map((l) => l.description)).toEqual(["CAPITAL 2026-08"]);
    expect(again.openingBalance).toBe("100000");
  });

  it("needs 'Reconcile accounts'; Field never", async () => {
    for (const who of [viewer, field]) {
      expect((await call(who, "POST", `/bank-reconciliations/${recs[0]}/undo`)).status).toBe(403);
      expect((await call(who, "GET", `/money-accounts/${bank.id}/reconciliations`)).status).toBe(403);
    }
  });
});
