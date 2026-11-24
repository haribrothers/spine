import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AccountRegister, BankTransfer, MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { auditLog, bankTransfers, journalLines, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-BANK-04 — transfers between money accounts post P22 and show in both
 * registers; deleting one reverses it. Requires local Postgres.
 */
describe("US-BANK-04 · move money between my accounts (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let bank: MoneyAccount;
  let reserve: MoneyAccount;
  let card: MoneyAccount;
  const owner: Who = { cookie: "", userId: "" };
  const recorder: Who = { cookie: "", userId: "" };
  const viewer: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const register = (id: string) => call(owner, "GET", `/money-accounts/${id}/register`).then((r) => json<AccountRegister>(r));
  const balances = async () => {
    const rows = await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"));
    return Object.fromEntries(rows.map((r) => [r.name, r.balance]));
  };

  async function newUser(name: string): Promise<Who> {
    const email = `us-bank-04-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
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
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(recorder, await newUser("recorder"));
    await join(recorder, "staff", ["banking.record"]);
    Object.assign(viewer, await newUser("viewer"));
    await join(viewer, "staff", ["banking.view"]);
    Object.assign(field, await newUser("field"));
    await join(field, "field");

    bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    reserve = await json<MoneyAccount>(await call(owner, "POST", "/money-accounts", { kind: "bank", name: "Tax reserve" }));
    card = await json<MoneyAccount>(await call(owner, "POST", "/money-accounts", { kind: "card", name: "Business Visa" }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("posts Dr To / Cr From and shows in both registers", async () => {
    const res = await call(owner, "POST", "/bank-transfers", { fromMoneyAccountId: bank.id, toMoneyAccountId: reserve.id, amount: "300000", date: "2026-09-28", reference: "TRF-0004" });
    expect(res.status).toBe(201);
    const transfer = await json<BankTransfer>(res);
    expect(transfer).toMatchObject({ fromMoneyAccount: { name: "Bank Account" }, toMoneyAccount: { name: "Tax reserve" }, amount: "300000", date: "2026-09-28", reference: "TRF-0004" });

    const [row] = await db.select().from(bankTransfers).where(eq(bankTransfers.id, transfer.id));
    const lines = await db.select().from(journalLines).where(eq(journalLines.entryId, row!.entryId));
    expect(lines.map((l) => [l.accountId, l.debit, l.credit]).sort()).toEqual(
      [
        [reserve.accountId, 300000n, 0n],
        [bank.accountId, 0n, 300000n],
      ].sort(),
    );

    const out = (await register(bank.id)).rows.find((r) => r.sourceId === transfer.id)!;
    expect(out).toMatchObject({ what: "Transfer to Tax reserve", reference: "TRF-0004", in: "0", out: "300000", deleted: false });
    const into = (await register(reserve.id)).rows.find((r) => r.sourceId === transfer.id)!;
    expect(into).toMatchObject({ what: "Transfer from Bank Account", in: "300000", out: "0" });
    expect(await balances()).toMatchObject({ "Bank Account": "-300000", "Tax reserve": "300000" });
  });

  it("paying off a card lowers what's owed", async () => {
    await json(await call(recorder, "POST", "/bank-transfers", { fromMoneyAccountId: bank.id, toMoneyAccountId: card.id, amount: "128460", date: "2026-09-29" }));
    const reg = await register(card.id);
    expect(reg.rows.at(-1)).toMatchObject({ what: "Transfer from Bank Account", in: "128460", balance: "-128460" });
  });

  it("refuses the same account in both fields", async () => {
    const res = await call(owner, "POST", "/bank-transfers", { fromMoneyAccountId: bank.id, toMoneyAccountId: bank.id, amount: "100", date: "2026-09-28" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Choose two different accounts.");
  });

  it("refuses a date in a closed period", async () => {
    const period = await json<{ id: string }>(await call(owner, "POST", "/org/fiscal-periods", { startDate: "2026-01-01", endDate: "2026-01-31" }));
    await json(await call(owner, "POST", `/org/fiscal-periods/${period.id}/close`));
    const res = await call(owner, "POST", "/bank-transfers", { fromMoneyAccountId: bank.id, toMoneyAccountId: reserve.id, amount: "100", date: "2026-01-15" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toContain("falls within a closed fiscal period");
  });

  it("deleting a transfer posts a reversing entry and both balances go back", async () => {
    const before = await balances();
    const transfer = await json<BankTransfer>(await call(owner, "POST", "/bank-transfers", { fromMoneyAccountId: reserve.id, toMoneyAccountId: bank.id, amount: "50000", date: "2026-09-30" }));
    expect((await call(owner, "DELETE", `/bank-transfers/${transfer.id}`)).status).toBe(200);
    expect(await balances()).toEqual(before);

    const [row] = await db.select().from(bankTransfers).where(eq(bankTransfers.id, transfer.id));
    expect(row!.deletedAt).not.toBeNull();
    expect(row!.reversalEntryId).not.toBeNull();
    const rows = (await register(bank.id)).rows.filter((r) => r.sourceId === transfer.id);
    expect(rows.map((r) => [r.sourceType, r.deleted])).toEqual([
      ["bank_transfer", true],
      ["bank_transfer_delete", true],
    ]);
    expect(rows[1]!.what).toBe("Transfer deleted");

    const again = await call(owner, "DELETE", `/bank-transfers/${transfer.id}`);
    expect(again.status).toBe(400);
    const audits = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "bank_transfer"), eq(auditLog.entityId, transfer.id)));
    expect(audits.map((a) => a.action).sort()).toEqual(["created", "deleted"]);
  });

  it("needs banking.record; Field never", async () => {
    const body = { fromMoneyAccountId: bank.id, toMoneyAccountId: reserve.id, amount: "100", date: "2026-09-28" };
    expect((await call(viewer, "POST", "/bank-transfers", body)).status).toBe(403);
    expect((await call(field, "POST", "/bank-transfers", body)).status).toBe(403);
    expect((await call(recorder, "POST", "/bank-transfers", body)).status).toBe(201);
  });
});
