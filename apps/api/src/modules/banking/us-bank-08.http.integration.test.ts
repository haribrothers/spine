import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount, ReconciliationView } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-BANK-08 — reconcile page data: brought-forward opening (D-176), match
 * suggestions, matches and exclusions saved as you go, cleared balance and
 * difference. Requires local Postgres.
 */
describe("US-BANK-08 · match statement lines to what's in Spine (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let code: Record<string, string>;
  let recId: string;
  const ids = {} as Record<"payment" | "cheque" | "fuel" | "partA" | "partB" | "mistake", string>;
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
  const moneyOut = async (amount: string, date: string, description: string) =>
    (await json<{ id: string }>(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code["6900"], amount, date, description }))).id;
  const lineId = (view: ReconciliationView, description: string) => view.statementLines.find((l) => l.description === description)!.id;
  const entryId = (view: ReconciliationView, sourceId: string) => view.entries.find((e) => e.sourceId === sourceId)!.journalLineId;

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
      const email = `us-bank-08-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(viewer, "staff", ["banking.view", "banking.record"]);
    await join(field, "field");
    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));

    // Before the statement: $10,000.00 of capital (brought forward).
    await json(await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: code["3000"], amount: "1000000", date: "2026-09-15" }));
    const contact = await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Maple Ridge Developments" }));
    ids.payment = (await json<{ id: string }>(await call(owner, "POST", "/payments", { contactId: contact.id, date: "2026-10-02", method: "bank_transfer", currency: "USD", amount: "454250", moneyAccountId: bank.id }))).id;
    ids.cheque = await moneyOut("216000", "2026-10-01", "Coastal Timber");
    ids.fuel = await moneyOut("5820", "2026-10-04", "Fuel");
    ids.partA = await moneyOut("6000", "2026-10-04", "Card part A");
    ids.partB = await moneyOut("4000", "2026-10-04", "Card part B");
    // Recorded then deleted: it and its reversal cancel out and aren't offered.
    ids.mistake = await moneyOut("777", "2026-10-03", "Mistake");
    await json(await call(owner, "DELETE", `/bank-transactions/${ids.mistake}`));

    const form = new FormData();
    form.append(
      "file",
      new Blob(
        [
          [
            "Date,Description,Amount",
            "2026-10-01,CHQ 000214 COASTAL TIMBER,-2160.00",
            "2026-10-01,NEFT-MAPLE RIDGE DEV,4542.50",
            "2026-10-03,INTEREST CREDIT,6.12",
            "2026-10-04,POS 4410 SHELL PORTLAND,-58.20",
            "2026-10-04,CARD SETTLEMENT,-100.00",
            "2026-10-09,AFTER THE END DATE,-1.00",
          ].join("\n"),
        ],
        { type: "text/csv" },
      ),
      "statement-oct-2026.csv",
    );
    form.append("mapping", JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" }));
    await json(await fetch(`${testApp.baseUrl}/money-accounts/${bank.id}/statement-imports`, { method: "POST", headers: { "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: form }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("starts with the balance brought forward, lines and entries up to the end date, and suggestions", async () => {
    const view = await json<ReconciliationView>(await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: "2026-10-04", statementClosingBalance: "1223042" }));
    recId = view.id;
    expect(view).toMatchObject({ status: "in_progress", openingBalance: "1000000", broughtForwardBefore: "2026-10-01", lastReconciledOn: null, clearedBalance: "1000000", difference: "223042", fileNames: ["statement-oct-2026.csv"] });
    expect(view.statementLines.map((l) => l.description)).toEqual(["CHQ 000214 COASTAL TIMBER", "NEFT-MAPLE RIDGE DEV", "INTEREST CREDIT", "POS 4410 SHELL PORTLAND", "CARD SETTLEMENT"]);
    // The deleted entry was still on the books on the end date (its reversal is dated today), so it's offered.
    expect(view.entries.map((e) => e.sourceId).sort()).toEqual([ids.payment, ids.cheque, ids.fuel, ids.partA, ids.partB, ids.mistake].sort());
    expect(view.entries.find((e) => e.sourceId === ids.payment)).toMatchObject({ what: expect.stringMatching(/^Payment /), contact: { name: "Maple Ridge Developments" }, amount: "454250" });
    const suggested = Object.fromEntries(view.suggestions.map((s) => [view.statementLines.find((l) => l.id === s.statementLineId)!.description, view.entries.find((e) => e.journalLineId === s.journalLineId)!.sourceId]));
    expect(suggested).toEqual({ "CHQ 000214 COASTAL TIMBER": ids.cheque, "NEFT-MAPLE RIDGE DEV": ids.payment, "POS 4410 SHELL PORTLAND": ids.fuel });
    // Starting again returns the one in progress.
    expect((await json<ReconciliationView>(await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: "2026-10-04", statementClosingBalance: "1223042" }))).id).toBe(recId);
  });

  it("matches only when the entries add up, and saves matches and exclusions as you go", async () => {
    const view = await json<ReconciliationView>(await call(owner, "GET", `/bank-reconciliations/${recId}`));
    const wrong = await call(owner, "PUT", `/bank-reconciliations/${recId}/matches`, { matches: [{ statementLineId: lineId(view, "CARD SETTLEMENT"), journalLineIds: [entryId(view, ids.partA)] }] });
    expect(wrong.status).toBe(400);
    expect(await message(wrong)).toBe("Selected entries add up to −$60.00; the line is −$100.00.");

    const body = {
      matches: [
        { statementLineId: lineId(view, "CHQ 000214 COASTAL TIMBER"), journalLineIds: [entryId(view, ids.cheque)] },
        { statementLineId: lineId(view, "NEFT-MAPLE RIDGE DEV"), journalLineIds: [entryId(view, ids.payment)] },
        { statementLineId: lineId(view, "POS 4410 SHELL PORTLAND"), journalLineIds: [entryId(view, ids.fuel)] },
        { statementLineId: lineId(view, "CARD SETTLEMENT"), journalLineIds: [entryId(view, ids.partA), entryId(view, ids.partB)] },
      ],
      exclusions: [{ statementLineId: lineId(view, "INTEREST CREDIT"), note: "Bank error, reversed next month" }],
    };
    const saved = await json<ReconciliationView>(await call(owner, "PUT", `/bank-reconciliations/${recId}/matches`, body));
    expect(saved).toMatchObject({ clearedBalance: "1223042", difference: "0", matchedCount: 5, suggestions: [] });
    expect(saved.statementLines.find((l) => l.description === "INTEREST CREDIT")).toMatchObject({ status: "excluded", excludeNote: "Bank error, reversed next month" });
    expect(saved.entries.find((e) => e.sourceId === ids.partB)!.statementLineId).toBe(lineId(view, "CARD SETTLEMENT"));

    // Leave and come back: still there.
    const again = await json<ReconciliationView>(await call(owner, "GET", `/bank-reconciliations/${recId}`));
    expect(again.matches).toHaveLength(4);
    expect(again.difference).toBe("0");
  });

  it("refuses a line or entry used twice, or one after the end date", async () => {
    const view = await json<ReconciliationView>(await call(owner, "GET", `/bank-reconciliations/${recId}`));
    const twice = await call(owner, "PUT", `/bank-reconciliations/${recId}/matches`, {
      matches: [
        { statementLineId: lineId(view, "CHQ 000214 COASTAL TIMBER"), journalLineIds: [entryId(view, ids.cheque)] },
        { statementLineId: lineId(view, "POS 4410 SHELL PORTLAND"), journalLineIds: [entryId(view, ids.cheque)] },
      ],
    });
    expect(await message(twice)).toBe("An entry can match only one statement line.");
    const lines = await json<{ id: string; description: string }[]>(await call(owner, "GET", `/money-accounts/${bank.id}/statement-lines`));
    const late = await call(owner, "PUT", `/bank-reconciliations/${recId}/matches`, { exclusions: [{ statementLineId: lines.find((l) => l.description === "AFTER THE END DATE")!.id }] });
    expect(await message(late)).toBe("That statement line is after the statement end date.");
  });

  it("moving the end date earlier drops matches after it", async () => {
    const moved = await json<ReconciliationView>(await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: "2026-10-03", statementClosingBalance: "1238862" }));
    expect(moved.id).toBe(recId);
    expect(moved.statementLines.map((l) => [l.description, l.status])).toEqual([
      ["CHQ 000214 COASTAL TIMBER", "matched"],
      ["NEFT-MAPLE RIDGE DEV", "matched"],
      ["INTEREST CREDIT", "excluded"],
    ]);
    expect(moved.difference).toBe("0");
  });

  it("an entry and its reversal both up to the end date cancel out and aren't offered", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const view = await json<ReconciliationView>(await call(owner, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: today, statementClosingBalance: "0" }));
    expect(view.entries.filter((e) => e.sourceId === ids.mistake)).toEqual([]);
    expect(view.entries.map((e) => e.sourceId)).toContain(ids.fuel);
  });

  it("needs 'Reconcile accounts'; Field never", async () => {
    for (const who of [viewer, field]) {
      expect((await call(who, "POST", "/bank-reconciliations", { moneyAccountId: bank.id, statementEndDate: "2026-10-04", statementClosingBalance: "0" })).status).toBe(403);
      expect((await call(who, "GET", `/bank-reconciliations/${recId}`)).status).toBe(403);
      expect((await call(who, "PUT", `/bank-reconciliations/${recId}/matches`, { matches: [] })).status).toBe(403);
      expect((await call(who, "GET", `/bank-reconciliations?moneyAccountId=${bank.id}`)).status).toBe(403);
    }
  });
});
