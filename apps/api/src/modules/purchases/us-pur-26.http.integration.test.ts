import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, journalEntries, journalLines, member, user, vendorRefunds } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Credit = { id: string; status: string; balanceAmount: string; refunds: { id: string; amount: string; deletedAt: string | null; moneyAccountName: string }[] };

/**
 * US-PUR-26 — a refund from the vendor posts P25 (Dr money account / Cr AP),
 * lowers the credit, and can be deleted (reversed). Requires local Postgres.
 */
describe("US-PUR-26 · record a refund from a vendor (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let creditId: string;
  let bank: MoneyAccount;
  let cookie = "";

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  async function linesOf(sourceType: string, sourceId: string) {
    const rows = await db
      .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(and(eq(journalEntries.sourceType, sourceType), eq(journalEntries.sourceId, sourceId)));
    return rows.map((r) => [r.code, r.debit, r.credit]).sort();
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-pur-26-${randomUUID()}@example.com`;
    emails.push(email);
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    bank = (await json<MoneyAccount[]>(await call("GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const credit = await json<{ id: string }>(await call("POST", "/vendor-credits", { contactId: vendor!.id, vendorReference: "CN-4471", date: "2026-10-03", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "40000" }] }));
    creditId = credit.id;
    await json(await call("POST", `/vendor-credits/${creditId}/record`));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("refuses more than the balance", async () => {
    const res = await call("POST", `/vendor-credits/${creditId}/refunds`, { amount: "40001", date: "2026-10-05", method: "bank_transfer", moneyAccountId: bank.id });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("This credit has $400.00 left to refund.");
  });

  it("posts P25 and the balance drops; the full amount makes it Used", async () => {
    const partial = await json<Credit>(await call("POST", `/vendor-credits/${creditId}/refunds`, { amount: "15000", date: "2026-10-05", method: "bank_transfer", moneyAccountId: bank.id, reference: "EFT-88" }));
    expect(partial).toMatchObject({ status: "open", balanceAmount: "25000" });
    expect(partial.refunds[0]).toMatchObject({ amount: "15000", moneyAccountName: "Bank Account", deletedAt: null });
    expect(await linesOf("vendor_refund", partial.refunds[0]!.id)).toEqual(
      [
        ["1010", 15000n, 0n],
        ["2000", 0n, 15000n],
      ].sort(),
    );
    const rest = await json<Credit>(await call("POST", `/vendor-credits/${creditId}/refunds`, { amount: "25000", date: "2026-10-06", method: "cash", moneyAccountId: bank.id }));
    expect(rest).toMatchObject({ status: "used", balanceAmount: "0" });
    const register = await json<{ rows: { what: string; in: string }[] }>(await call("GET", `/money-accounts/${bank.id}/register`));
    expect(register.rows.filter((r) => r.what === "Vendor refund").map((r) => r.in)).toEqual(["15000", "25000"]);
  });

  it("deleting a refund reverses it and the balance returns", async () => {
    const credit = await json<Credit>(await call("GET", `/vendor-credits/${creditId}`));
    const first = credit.refunds[0]!;
    const after = await json<Credit>(await call("DELETE", `/vendor-refunds/${first.id}`));
    expect(after).toMatchObject({ status: "open", balanceAmount: "15000" });
    expect(await linesOf("vendor_refund_delete", first.id)).toEqual(
      [
        ["1010", 0n, 15000n],
        ["2000", 15000n, 0n],
      ].sort(),
    );
    expect((await call("DELETE", `/vendor-refunds/${first.id}`)).status).toBe(400);
  });

  it("the database refuses refunds beyond the credit", async () => {
    const [refund] = await db.select().from(vendorRefunds).where(and(eq(vendorRefunds.vendorCreditId, creditId), eq(vendorRefunds.amount, 25000n)));
    await expect(db.update(vendorRefunds).set({ amount: 40001n }).where(eq(vendorRefunds.id, refund!.id))).rejects.toThrow();
  });
});
