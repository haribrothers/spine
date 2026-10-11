import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BulkResult, PossibleDuplicateVendorBill, VendorBillActivityEntry } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-PUR-32, US-PUR-35, US-PUR-36 (D-225) — a bill's Activity, the
 * same-number warning before entering a bill twice, and recording several
 * drafts at once. Requires local Postgres.
 */
describe("US-PUR-32 to US-PUR-36 · vendor bills you can work from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let vendorId: string;
  let otherVendorId: string;
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
  const draft = async (billNumber: string, amount: string, contactId = vendorId) =>
    json<{ id: string }>(await call("POST", "/vendor-bills", { contactId, billNumber, date: "2026-09-25", dueDate: "2026-10-15", currency: "USD", lines: [{ type: "item", name: "Plant hire", quantity: 1, unitPriceAmount: amount }] }));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-pur-32-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(owner, await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Priya Raman" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Ridgeline Equipment Rentals", createdByUserId: owner.userId }).returning();
    const [other] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Apex Building Materials", createdByUserId: owner.userId }).returning();
    vendorId = vendor!.id;
    otherVendorId = other!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("US-PUR-32: Activity lists created, recorded, each payment and credit, newest first, with who", async () => {
    const bill = await json<{ id: string }>(await call("POST", "/vendor-bills", { contactId: vendorId, billNumber: "RTE-3302", date: "2026-09-25", currency: "USD", lines: [{ type: "item", name: "JCB hire", quantity: 1, unitPriceAmount: "100000" }] }));
    await json(await call("POST", `/vendor-bills/${bill.id}/record`));
    const payment = await json<{ id: string; number: string }>(
      await call("POST", "/vendor-payments", { contactId: vendorId, date: "2026-10-02", method: "bank_transfer", currency: "USD", amount: "60000", allocations: [{ billId: bill.id, amount: "60000" }] }),
    );
    const credit = await json<{ id: string }>(await call("POST", "/vendor-credits", { contactId: vendorId, vendorReference: "CN-77", date: "2026-10-03", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "10000" }] }));
    await json(await call("POST", `/vendor-credits/${credit.id}/record`));
    await json(await call("POST", `/vendor-credits/${credit.id}/apply`, { allocations: [{ billId: bill.id, amount: "10000" }] }));

    const activity = await json<VendorBillActivityEntry[]>(await call("GET", `/vendor-bills/${bill.id}/activity`));
    expect(activity.map((a) => a.type)).toEqual(["credit_applied", "paid", "recorded", "created"]);
    expect(activity[0]).toMatchObject({ amount: "10000", linkId: credit.id, actorName: "Priya Raman" });
    expect(activity[0]!.detail).toMatch(/^VCR-/);
    expect(activity[1]).toMatchObject({ amount: "60000", detail: payment.number, linkId: payment.id, actorName: "Priya Raman" });
    expect(activity[2]).toMatchObject({ amount: "100000", actorName: "Priya Raman" });

    // A voided bill says why.
    const wrong = await draft("RTE-0001", "5000");
    await json(await call("POST", `/vendor-bills/${wrong.id}/record`));
    await json(await call("POST", `/vendor-bills/${wrong.id}/void`, { reason: "Entered on the wrong vendor" }));
    const voided = await json<VendorBillActivityEntry[]>(await call("GET", `/vendor-bills/${wrong.id}/activity`));
    expect(voided[0]).toMatchObject({ type: "voided", detail: "Entered on the wrong vendor" });
  });

  it("US-PUR-35: the same vendor's bill with the same number, ignoring case and spaces; not void, not another vendor's, not itself", async () => {
    const first = await draft("ABM 20587", "18000");
    await draft("ABM-20587", "1000", otherVendorId);
    const voided = await draft("abm20587", "2000");
    await json(await call("POST", `/vendor-bills/${voided.id}/record`));
    await json(await call("POST", `/vendor-bills/${voided.id}/void`, { reason: "Duplicate" }));

    const found = await json<PossibleDuplicateVendorBill[]>(await call("GET", `/vendor-bills/possible-duplicates?contactId=${vendorId}&billNumber=${encodeURIComponent("abm20587 ")}`));
    expect(found).toEqual([{ id: first.id, billNumber: "ABM 20587", date: "2026-09-25", totalAmount: "18000", currency: "USD", status: "draft" }]);
    expect(await json<unknown[]>(await call("GET", `/vendor-bills/possible-duplicates?contactId=${vendorId}&billNumber=ABM20587&excludeId=${first.id}`))).toEqual([]);
    expect(await json<unknown[]>(await call("GET", `/vendor-bills/possible-duplicates?contactId=${vendorId}&billNumber=`))).toEqual([]);
    expect((await call("GET", "/vendor-bills/possible-duplicates?billNumber=X")).status).toBe(400);
  });

  it("US-PUR-36: records each draft, naming the ones it skips and why", async () => {
    const a = await draft("KSE-771", "4248");
    const b = await draft("CSW-5611", "26432");
    const recorded = await draft("CSW-5502", "41064");
    await json(await call("POST", `/vendor-bills/${recorded.id}/record`));
    const missing = randomUUID();

    const result = await json<BulkResult>(await call("POST", "/vendor-bills/bulk/record", { ids: [a.id, b.id, recorded.id, missing] }));
    expect(result.done.sort()).toEqual([a.id, b.id].sort());
    expect(result.skipped).toEqual([
      { id: recorded.id, label: "CSW-5502", reason: "It's already recorded." },
      { id: missing, label: null, reason: "Not found." },
    ]);
    const after = await json<{ status: string }>(await call("GET", `/vendor-bills/${a.id}`));
    expect(after.status).toBe("recorded");

    const tooMany = await call("POST", "/vendor-bills/bulk/record", { ids: Array.from({ length: 101 }, () => randomUUID()) });
    expect(tooMany.status).toBe(400);
    expect(((await tooMany.json()) as { message: string }).message).toBe("Select 100 or fewer bills.");
  });
});
