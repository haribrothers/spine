import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AccountRegister, MoneyAccount, ReconciliationView } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, auditLog, bankTransactions, journalEntries, journalLines, member, payments, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** US-BANK-10 — finish at a zero difference; reconciled entries are locked against void and delete. Requires local Postgres. */
describe("US-BANK-10 · finish a reconciliation when it balances (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let code: Record<string, string>;
  let recId: string;
  const ids = {} as Record<"capital" | "payment" | "cheque" | "mistake", string>;
  const today = iso(new Date());
  const tomorrow = iso(new Date(Date.now() + 86_400_000));
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
  const money = async (direction: "in" | "out", amount: string, date: string, accountCode = direction === "in" ? "3000" : "6900") =>
    (await json<{ id: string }>(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction, accountId: code[accountCode], amount, date }))).id;
  const importLines = async (lines: string[]) => {
    const form = new FormData();
    form.append("file", new Blob([["Date,Description,Amount", ...lines].join("\n")], { type: "text/csv" }), `statement-${randomUUID().slice(0, 4)}.csv`);
    form.append("mapping", JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" }));
    await json(await fetch(`${testApp.baseUrl}/money-accounts/${bank.id}/statement-imports`, { method: "POST", headers: { "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: form }));
  };
  const lineId = (view: ReconciliationView, description: string) => view.statementLines.find((l) => l.description === description)!.id;
  const entryOf = (view: ReconciliationView, sourceId: string) => view.entries.find((e) => e.sourceId === sourceId)!.journalLineId;
  const reconciledLines = async (sourceIds: string[]) =>
    db
      .select({ sourceId: journalEntries.sourceId, reconciliationId: journalLines.reconciliationId })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .where(and(eq(journalLines.accountId, bank.accountId), inArray(journalEntries.sourceId, sourceIds)));

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
      const email = `us-bank-10-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(viewer, "staff", ["banking.view", "banking.record"]);
    await join(field, "field");
    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));

    ids.capital = await money("in", "1000000", "2026-09-15");
    const contact = await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Maple Ridge Developments" }));
    ids.payment = (await json<{ id: string }>(await call(owner, "POST", "/payments", { contactId: contact.id, date: "2026-10-02", method: "bank_transfer", currency: "USD", amount: "454250", moneyAccountId: bank.id }))).id;
    ids.cheque = await money("out", "216000", "2026-10-01");
    ids.mistake = await money("out", "777", "2026-10-03");
    await json(await call(owner, "DELETE", `/bank-transactions/${ids.mistake}`));
    await importLines(["2026-10-01,CHQ 000214 COASTAL TIMBER,-2160.00", "2026-10-01,NEFT-MAPLE RIDGE DEV,4542.50"]);
    recId = (await json<ReconciliationView>(await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: today, statementClosingBalance: "1238250" }))).id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("can't finish while there's a difference", async () => {
    const res = await call(owner, "POST", `/bank-reconciliations/${recId}/finish`);
    expect(res.status).toBe(400);
    expect(await message(res)).toBe("Difference $2,382.50 — match or create entries until it's zero.");
  });

  it("finishes at zero: matched, brought-forward and cancelled-out entries get the tick", async () => {
    const view = await json<ReconciliationView>(await call(owner, "GET", `/bank-reconciliations/${recId}`));
    const matched = await json<ReconciliationView>(
      await call(owner, "PUT", `/bank-reconciliations/${recId}/matches`, {
        matches: [
          { statementLineId: lineId(view, "CHQ 000214 COASTAL TIMBER"), journalLineIds: [entryOf(view, ids.cheque)] },
          { statementLineId: lineId(view, "NEFT-MAPLE RIDGE DEV"), journalLineIds: [entryOf(view, ids.payment)] },
        ],
      }),
    );
    expect(matched.difference).toBe("0");
    const finished = await json<ReconciliationView>(await call(owner, "POST", `/bank-reconciliations/${recId}/finish`));
    expect(finished).toMatchObject({ status: "finished", lastReconciledOn: today, openingBalance: "1000000", broughtForwardBefore: "2026-10-01", finishedBy: { name: "owner" } });

    const rows = await reconciledLines([ids.capital, ids.payment, ids.cheque, ids.mistake]);
    expect(rows.length).toBe(5); // the mistake has its reversal too
    expect(rows.every((r) => r.reconciliationId === recId)).toBe(true);
    const register = await json<AccountRegister>(await call(owner, "GET", `/money-accounts/${bank.id}/register`));
    expect(register.rows.every((r) => r.reconciled)).toBe(true);
    const listed = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.id === bank.id)!;
    // Reconciling never changes the balance.
    expect(listed).toMatchObject({ lastReconciledOn: today, unreconciledCount: 0, balance: "1238250" });

    const [audit] = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "bank_reconciliation"), eq(auditLog.entityId, recId)));
    expect(audit).toMatchObject({ action: "finished", actorUserId: owner.userId });
    expect(audit!.changes).toMatchObject({ closingBalance: "1238250", account: "Bank Account" });
  });

  it("a reconciled entry's document can't be deleted until the reconciliation is undone", async () => {
    const day = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
    const expected = `This entry is part of a finished reconciliation of Bank Account to ${day}. Undo that reconciliation first.`;
    const payment = await call(owner, "DELETE", `/payments/${ids.payment}`);
    expect(payment.status).toBe(400);
    expect(await message(payment)).toBe(expected);
    const cheque = await call(owner, "DELETE", `/bank-transactions/${ids.cheque}`);
    expect(await message(cheque)).toBe(expected);
    expect((await db.select().from(payments).where(eq(payments.id, ids.payment)))[0]).toBeDefined();
    expect((await db.select().from(bankTransactions).where(eq(bankTransactions.id, ids.cheque)))[0]!.deletedAt).toBeNull();
  });

  it("the next reconciliation needs a later end date", async () => {
    const res = await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: today, statementClosingBalance: "0" });
    expect(res.status).toBe(400);
    expect(await message(res)).toMatch(/^Choose a date after .+, when this account was last reconciled\.$/);
  });

  it("deleting a document matched in a reconciliation still in progress unmatches its line", async () => {
    const fees = await money("out", "5000", tomorrow);
    await importLines([`${tomorrow},ACCOUNT FEES,-50.00`]);
    const view = await json<ReconciliationView>(await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: tomorrow, statementClosingBalance: "1233250" }));
    expect(view.openingBalance).toBe("1238250");
    await json(await call(owner, "PUT", `/bank-reconciliations/${view.id}/matches`, { matches: [{ statementLineId: lineId(view, "ACCOUNT FEES"), journalLineIds: [entryOf(view, fees)] }] }));
    await json(await call(owner, "DELETE", `/bank-transactions/${fees}`));
    const after = await json<ReconciliationView>(await call(owner, "GET", `/bank-reconciliations/${view.id}`));
    expect(after.matches).toEqual([]);
    expect(after.statementLines.find((l) => l.description === "ACCOUNT FEES")!.status).toBe("unmatched");
  });

  it("journal lines stay immutable apart from reconciliation_id", async () => {
    const [line] = await db.select().from(journalLines).where(eq(journalLines.accountId, bank.accountId)).limit(1);
    await expect(db.update(journalLines).set({ debit: line!.debit + 1n }).where(eq(journalLines.id, line!.id))).rejects.toThrow();
    await db.update(journalLines).set({ reconciliationId: line!.reconciliationId }).where(eq(journalLines.id, line!.id));
  });

  it("needs 'Reconcile accounts'; Field never", async () => {
    for (const who of [viewer, field]) expect((await call(who, "POST", `/bank-reconciliations/${recId}/finish`)).status).toBe(403);
  });
});
