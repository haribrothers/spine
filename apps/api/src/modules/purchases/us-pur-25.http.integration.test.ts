import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, journalEntries, member, user, vendorBills } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };
type Credit = { id: string; status: string; balanceAmount: string; allocations: { id: string; billId: string; amount: string }[] };

/**
 * US-PUR-25 (P24a) — applying a vendor credit to the vendor's bills posts
 * nothing, lowers the bills' and the credit's balances, and can be undone.
 * Requires local Postgres.
 */
describe("US-PUR-25 · apply a vendor credit to bills (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let vendorId: string;
  let creditId: string;
  let older: string;
  let newer: string;
  const owner: Who = { cookie: "", userId: "" };

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const bill = async (id: string) => json<{ balanceDue: string; creditsApplied: { number: string; amount: string }[] }>(await call("GET", `/vendor-bills/${id}`));
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  async function recordedBill(number: string, amount: string, date: string, contactId = vendorId) {
    const created = await json<{ id: string }>(await call("POST", "/vendor-bills", { contactId, billNumber: number, date, currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: amount }] }));
    await json(await call("POST", `/vendor-bills/${created.id}/record`));
    return created.id;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-pur-25-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(owner, await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    vendorId = vendor!.id;
    older = await recordedBill("88213", "30000", "2026-09-01");
    newer = await recordedBill("88240", "50000", "2026-09-20");
    const credit = await json<{ id: string }>(await call("POST", "/vendor-credits", { contactId: vendorId, vendorReference: "CN-4471", date: "2026-10-03", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "40000" }] }));
    creditId = credit.id;
    await json(await call("POST", `/vendor-credits/${creditId}/record`));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("refuses more than a bill's balance or the credit's, and another vendor's bills", async () => {
    const overBill = await call("POST", `/vendor-credits/${creditId}/apply`, { allocations: [{ billId: older, amount: "30001" }] });
    expect(overBill.status).toBe(400);
    expect(await message(overBill)).toBe("You can apply up to $300.00 to this bill.");
    const overCredit = await call("POST", `/vendor-credits/${creditId}/apply`, { allocations: [{ billId: newer, amount: "40001" }] });
    expect(await message(overCredit)).toBe("This credit has $400.00 left to apply.");
    const [other] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Harbor Plant Hire", createdByUserId: owner.userId }).returning();
    const theirs = await recordedBill("H-1", "10000", "2026-09-05", other!.id);
    expect((await call("POST", `/vendor-credits/${creditId}/apply`, { allocations: [{ billId: theirs, amount: "100" }] })).status).toBe(400);
  });

  it("applies across bills without posting anything; at zero the credit is Used", async () => {
    const entriesBefore = (await db.select().from(journalEntries).where(eq(journalEntries.orgId, orgId))).length;
    const applied = await json<Credit>(await call("POST", `/vendor-credits/${creditId}/apply`, { allocations: [{ billId: older, amount: "30000" }, { billId: newer, amount: "10000" }] }));
    expect(applied).toMatchObject({ status: "used", balanceAmount: "0" });
    expect(applied.allocations.map((a) => a.amount)).toEqual(["30000", "10000"]);
    expect((await db.select().from(journalEntries).where(eq(journalEntries.orgId, orgId))).length).toBe(entriesBefore);
    expect((await bill(older)).balanceDue).toBe("0");
    const newerBill = await bill(newer);
    expect(newerBill.balanceDue).toBe("40000");
    expect(newerBill.creditsApplied).toMatchObject([{ number: "VCR-0001", amount: "10000" }]);
  });

  it("payments and voids respect the credits; the payables list counts them", async () => {
    const overpay = await call("POST", "/vendor-payments", { contactId: vendorId, date: "2026-10-04", method: "cash", currency: "USD", amount: "40001", allocations: [{ billId: newer, amount: "40001" }] });
    expect(overpay.status).toBe(400);
    const voidRes = await call("POST", `/vendor-bills/${older}/void`, { reason: "Wrong" });
    expect(await message(voidRes)).toBe("Remove the vendor credits applied to this bill before voiding it.");
    const payables = await json<{ bills: { id: string; balanceDue: string }[] }>(await call("GET", "/reports/payables"));
    expect(payables.bills.find((b) => b.id === older)).toBeUndefined();
    expect(payables.bills.find((b) => b.id === newer)?.balanceDue).toBe("40000");
  });

  it("removing an application gives both balances back", async () => {
    const credit = await json<Credit>(await call("GET", `/vendor-credits/${creditId}`));
    const toNewer = credit.allocations.find((a) => a.billId === newer)!;
    const after = await json<Credit>(await call("DELETE", `/vendor-credits/${creditId}/allocations/${toNewer.id}`));
    expect(after).toMatchObject({ status: "open", balanceAmount: "10000" });
    expect((await bill(newer)).balanceDue).toBe("50000");
  });

  it("the database refuses credits beyond a bill even if the service check is skipped", async () => {
    const [row] = await db.select().from(vendorBills).where(eq(vendorBills.id, older));
    await expect(db.update(vendorBills).set({ creditedAmount: row!.totalAmount + 1n }).where(eq(vendorBills.id, older))).rejects.toThrow();
  });
});
