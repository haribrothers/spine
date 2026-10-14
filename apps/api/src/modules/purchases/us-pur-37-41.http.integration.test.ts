import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BulkResult, PossibleDuplicateVendorCredit, VendorCreditActivityEntry } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-PUR-37, US-PUR-38, US-PUR-39, US-PUR-41 (D-226) — a credit's Activity,
 * the list's bill and job, the same-number warning before entering a
 * credit twice, and recording several drafts at once. Requires local
 * Postgres.
 */
describe("US-PUR-37 to US-PUR-41 · vendor credits you can work from (requires local Postgres)", () => {
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
  const credit = async (vendorReference: string, amount: string, extra: Record<string, unknown> = {}, contactId = vendorId) =>
    json<{ id: string; number: string | null }>(
      await call("POST", "/vendor-credits", { contactId, vendorReference, date: "2026-10-03", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: amount }], ...extra }),
    );
  const bill = async (billNumber: string, amount: string) => {
    const created = await json<{ id: string }>(await call("POST", "/vendor-bills", { contactId: vendorId, billNumber, date: "2026-09-25", currency: "USD", lines: [{ type: "item", name: "JCB hire", quantity: 1, unitPriceAmount: amount }] }));
    await json(await call("POST", `/vendor-bills/${created.id}/record`));
    return created;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-pur-37-${randomUUID()}@example.com`;
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

  it("US-PUR-37: Activity lists created, recorded, applied, removed, refunded and refund deleted, newest first, with who", async () => {
    const rte = await bill("RTE-3302", "100000");
    const vc = await credit("CN-77", "20000", { billId: rte.id });
    await json(await call("POST", `/vendor-credits/${vc.id}/record`));
    const applied = await json<{ allocations: { id: string }[] }>(await call("POST", `/vendor-credits/${vc.id}/apply`, { allocations: [{ billId: rte.id, amount: "5000" }] }));
    await json(await call("DELETE", `/vendor-credits/${vc.id}/allocations/${applied.allocations[0]!.id}`));
    await json(await call("POST", `/vendor-credits/${vc.id}/apply`, { allocations: [{ billId: rte.id, amount: "8000" }] }));
    const refunded = await json<{ refunds: { id: string }[] }>(await call("POST", `/vendor-credits/${vc.id}/refunds`, { amount: "2000", date: "2026-10-05", method: "bank_transfer" }));
    await json(await call("DELETE", `/vendor-refunds/${refunded.refunds[0]!.id}`));

    const activity = await json<VendorCreditActivityEntry[]>(await call("GET", `/vendor-credits/${vc.id}/activity`));
    expect(activity.map((a) => a.type)).toEqual(["refund_deleted", "refunded", "applied", "unapplied", "recorded", "created"]);
    expect(activity[0]).toMatchObject({ amount: "2000", actorName: "Priya Raman" });
    expect(activity[1]).toMatchObject({ amount: "2000" });
    expect(activity[2]).toMatchObject({ amount: "8000", detail: "RTE-3302", linkId: rte.id });
    expect(activity[3]).toMatchObject({ amount: "5000", detail: "RTE-3302" });
    expect(activity[4]).toMatchObject({ amount: "20000" });

    // The page shows the job's name; a voided credit says why.
    const wrong = await credit("CN-01", "3000");
    await json(await call("POST", `/vendor-credits/${wrong.id}/record`));
    await json(await call("POST", `/vendor-credits/${wrong.id}/void`, { reason: "Entered on the wrong vendor" }));
    const voided = await json<VendorCreditActivityEntry[]>(await call("GET", `/vendor-credits/${wrong.id}/activity`));
    expect(voided[0]).toMatchObject({ type: "voided", detail: "Entered on the wrong vendor" });
    expect(await json<{ jobName: string | null }>(await call("GET", `/vendor-credits/${wrong.id}`))).toMatchObject({ jobName: null });
  });

  it("US-PUR-38: the list carries the bill and job, newest by date first", async () => {
    const rte = await bill("RTE-3400", "50000");
    const older = await credit("CN-OLD", "1000", { date: "2026-08-01", billId: rte.id });
    const newer = await credit("CN-NEW", "1000", { date: "2026-10-09" });
    const rows = await json<{ id: string; billNumber: string | null; jobName: string | null; date: string }[]>(await call("GET", `/vendor-credits?contactId=${vendorId}`));
    const ids = rows.map((r) => r.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    expect(rows.find((r) => r.id === older.id)).toMatchObject({ billNumber: "RTE-3400", jobName: null });
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1]!.date >= rows[i]!.date).toBe(true);
  });

  it("US-PUR-39: the same credit note number from the same vendor is found, ignoring case and spaces; not a void one or another vendor's", async () => {
    const first = await credit("CN-4471", "5000");
    await credit("CN-4471", "5000", {}, otherVendorId);
    const dupes = await json<PossibleDuplicateVendorCredit[]>(await call("GET", `/vendor-credits/possible-duplicates?contactId=${vendorId}&vendorReference=${encodeURIComponent(" cn - 4471 ")}`));
    expect(dupes.map((d) => d.id)).toEqual([first.id]);
    expect(dupes[0]).toMatchObject({ vendorReference: "CN-4471", totalAmount: "5000", currency: "USD", status: "draft" });
    const self = await json<PossibleDuplicateVendorCredit[]>(await call("GET", `/vendor-credits/possible-duplicates?contactId=${vendorId}&vendorReference=CN-4471&excludeId=${first.id}`));
    expect(self).toEqual([]);
    await json(await call("POST", `/vendor-credits/${first.id}/record`));
    await json(await call("POST", `/vendor-credits/${first.id}/void`, { reason: "Duplicate" }));
    expect(await json(await call("GET", `/vendor-credits/possible-duplicates?contactId=${vendorId}&vendorReference=CN-4471`))).toEqual([]);
  });

  it("US-PUR-41: records several drafts, each on its own, naming the ones it skipped", async () => {
    const a = await credit("CN-B1", "1000");
    const b = await credit("CN-B2", "2000");
    const recorded = await credit("CN-B3", "3000");
    await json(await call("POST", `/vendor-credits/${recorded.id}/record`));
    const empty = await json<{ id: string }>(await call("POST", "/vendor-credits", { contactId: vendorId, vendorReference: "CN-B4", date: "2026-10-03", currency: "USD", lines: [] }));
    const missing = randomUUID();
    const result = await json<BulkResult>(await call("POST", "/vendor-credits/bulk/record", { ids: [a.id, b.id, recorded.id, empty.id, missing] }));
    expect(result.done.sort()).toEqual([a.id, b.id].sort());
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: recorded.id, reason: "It's already recorded." }),
        expect.objectContaining({ id: empty.id, label: "CN-B4", reason: "Add a line with an amount before recording this credit." }),
        expect.objectContaining({ id: missing, label: null, reason: "Not found." }),
      ]),
    );
    const res = await call("POST", "/vendor-credits/bulk/record", { ids: Array.from({ length: 101 }, () => randomUUID()) });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Select 100 or fewer credits.");
  });
});
