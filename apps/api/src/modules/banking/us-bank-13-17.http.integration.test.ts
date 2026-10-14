import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BankEntryDetails, BankTransaction, BankTransfer, MoneyAccount, ReconciliationView } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (offset: number) => iso(new Date(Date.now() + offset * 86_400_000));

/**
 * US-BANK-14, US-BANK-16, US-BANK-17 (D-231) — the register exports what's
 * on screen, a money in or out entry and a transfer read on their own, the
 * imported statement says where it ends, and a finished reconciliation
 * says what's outstanding and downloads as a report. Requires local Postgres.
 */
describe("US-BANK-13 to US-BANK-17 · banking you can work from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let cash: MoneyAccount;
  let code: Record<string, string>;
  const ids = {} as Record<"capital" | "charge" | "late" | "transfer" | "rec", string>;
  const owner: Who = { cookie: "", userId: "" };
  const viewer: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const money = async (direction: "in" | "out", amount: string, date: string, accountCode = direction === "in" ? "3000" : "6900") =>
    (await json<{ id: string }>(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction, accountId: code[accountCode], amount, date }))).id;

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
    for (const [who, name] of [[owner, "Priya Raman"], [viewer, "viewer"], [field, "field"]] as const) {
      const email = `us-bank-13-${name.replace(/\W/g, "")}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(viewer, "staff", ["banking.view"]);
    await join(field, "field");
    const all = await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"));
    bank = all.find((a) => a.code === "1010")!;
    cash = all.find((a) => a.code === "1000")!;
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));

    ids.capital = await money("in", "1000000", day(-40));
    ids.charge = await money("out", "590", day(-20));
    ids.transfer = (await json<BankTransfer>(await call(owner, "POST", "/bank-transfers", { fromMoneyAccountId: bank.id, toMoneyAccountId: cash.id, amount: "10000", date: day(-10), reference: "Petty cash top-up" }))).id;
    // Paid out after the statement's last line: outstanding.
    ids.late = await money("out", "1200", day(-5));

    // The statement, with the bank's running balance.
    const form = new FormData();
    const rows = [`${day(-40)},CAPITAL,10000.00,10000.00`, `${day(-20)},SMS CHGS,-5.90,9994.10`, `${day(-10)},TRF TO CASH,-100.00,9894.10`];
    form.append("file", new Blob([["Date,Description,Amount,Balance", ...rows].join("\n")], { type: "text/csv" }), "bank-statement.csv");
    form.append("mapping", JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount", balance: "Balance" }));
    await json(await fetch(`${testApp.baseUrl}/money-accounts/${bank.id}/statement-imports`, { method: "POST", headers: { "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: form }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("US-BANK-16: the imported statement says where it ends, with the bank's balance", async () => {
    const end = await json<{ date: string; closingBalance: string; fileName: string } | null>(await call(owner, "GET", `/money-accounts/${bank.id}/statement-end`));
    expect(end).toEqual({ date: day(-10), closingBalance: "989410", fileName: "bank-statement.csv" });
    // Without the reconcile right it's refused.
    expect((await call(viewer, "GET", `/money-accounts/${bank.id}/statement-end`)).status).toBe(403);
  });

  it("US-BANK-17: a finished reconciliation says what's outstanding and how Spine and the statement agree", async () => {
    const started = await json<ReconciliationView>(await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: day(-3), statementClosingBalance: "989410" }));
    ids.rec = started.id;
    // Every suggestion at once (one save, as "Match all suggested" does).
    expect(started.suggestions).toHaveLength(3);
    const matched = await json<ReconciliationView>(
      await call(owner, "PUT", `/bank-reconciliations/${ids.rec}/matches`, { matches: started.suggestions.map((s) => ({ statementLineId: s.statementLineId, journalLineIds: [s.journalLineId] })), exclusions: [] }),
    );
    expect(matched.difference).toBe("0");
    expect(matched.outstanding.map((e) => e.sourceId)).toEqual([ids.late]);
    await json(await call(owner, "POST", `/bank-reconciliations/${ids.rec}/finish`));

    const view = await json<ReconciliationView>(await call(owner, "GET", `/bank-reconciliations/${ids.rec}`));
    expect(view.status).toBe("finished");
    expect(view.finishedBy?.name).toBe("Priya Raman");
    expect(view.outstanding.map((e) => [e.sourceId, e.amount])).toEqual([[ids.late, "-1200"]]);
    expect(view.excludedTotal).toBe("0");
    // Statement closing + deposits not yet on it − payments not yet on it = Spine's balance on the end date.
    expect(BigInt(view.statementClosingBalance) + BigInt(view.outstanding[0]!.amount)).toBe(BigInt(view.spineBalance));
    expect(view.spineBalance).toBe("988210");

    const pdf = await call(owner, "GET", `/bank-reconciliations/${ids.rec}/report.pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toContain("application/pdf");
    expect(pdf.headers.get("content-disposition")).toBe(`attachment; filename="reconciliation-bank-account-${day(-3)}.pdf"`);
    expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    expect((await call(viewer, "GET", `/bank-reconciliations/${ids.rec}/report.pdf`)).status).toBe(403);
    expect((await call(field, "GET", `/bank-reconciliations/${ids.rec}/report.pdf`)).status).toBe(403);
  });

  it("US-BANK-14: a money in or out entry and a transfer read on their own, reconciled or not", async () => {
    const charge = await json<BankTransaction & BankEntryDetails>(await call(viewer, "GET", `/bank-transactions/${ids.charge}`));
    expect(charge).toMatchObject({ direction: "out", amount: "590", reconciled: true, createdBy: "Priya Raman", moneyAccount: { id: bank.id } });
    expect(charge.account.code).toBe("6900");
    const late = await json<BankTransaction & BankEntryDetails>(await call(viewer, "GET", `/bank-transactions/${ids.late}`));
    expect(late.reconciled).toBe(false);
    const transfer = await json<BankTransfer & BankEntryDetails>(await call(viewer, "GET", `/bank-transfers/${ids.transfer}`));
    expect(transfer).toMatchObject({ amount: "10000", reference: "Petty cash top-up", reconciled: true, fromMoneyAccount: { id: bank.id }, toMoneyAccount: { id: cash.id } });
    expect((await call(field, "GET", `/bank-transactions/${ids.charge}`)).status).toBe(403);
    expect((await call(owner, "GET", `/bank-transactions/${randomUUID()}`)).status).toBe(404);
  });

  it("US-BANK-14: the register exports what's on screen — range, type and search — between its opening and closing balance", async () => {
    const base = `/money-accounts/${bank.id}/register?from=${day(-30)}&to=${day(0)}`;
    const csv = await call(viewer, "GET", `${base}&type=transfers&format=csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-disposition")).toContain(`filename="bank-account-${day(-30)}-${day(0)}.csv"`);
    const lines = (await csv.text()).trim().split(/\r?\n/);
    expect(lines[0]).toBe("Date,What,Contact,Reference,Money in,Money out,Balance,Reconciled,Currency");
    // Opening (the capital before the range), the transfer, and the closing balance.
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain("Opening balance");
    expect(lines[1]).toContain("10000.00");
    expect(lines[2]).toMatch(/Transfer to Cash in Hand,,Petty cash top-up,,100\.00,.*Reconciled/);
    expect(lines[3]).toContain("Closing balance");
    expect(lines[3]).toContain("9882.10");

    const searched = await (await call(viewer, "GET", `${base}&search=petty&format=csv`)).text();
    expect(searched.trim().split(/\r?\n/)).toHaveLength(4);
    for (const format of ["xlsx", "pdf"]) expect((await call(viewer, "GET", `${base}&format=${format}`)).status).toBe(200);

    const bad = await call(viewer, "GET", `${base}&type=loans`);
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toBe("Choose a type to show.");
  });
});
