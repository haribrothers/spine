import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, journalEntries, journalLines, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-PUR-27 — voiding a vendor credit reverses P24, only with nothing applied or refunded. Requires local Postgres. */
describe("US-PUR-27 · void a vendor credit (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let vendorId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  async function recordedCredit(amount = "40000") {
    const credit = await json<{ id: string }>(await call(owner, "POST", "/vendor-credits", { contactId: vendorId, vendorReference: "CN-4471", date: "2026-10-03", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: amount }] }));
    await json(await call(owner, "POST", `/vendor-credits/${credit.id}/record`));
    return credit.id;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"]] as const) {
      const email = `us-pur-27-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values({ teamId: team!.id, capability: "vendor_credits.apply", granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    vendorId = vendor!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("a credit with nothing used voids: P24 is reversed and it reads 'Void — <reason>'", async () => {
    const id = await recordedCredit();
    const voided = await json<{ status: string; voidReason: string }>(await call(owner, "POST", `/vendor-credits/${id}/void`, { reason: "Entered twice" }));
    expect(voided).toMatchObject({ status: "void", voidReason: "Entered twice" });
    const lines = await db
      .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(and(eq(journalEntries.sourceType, "vendor_credit_void"), eq(journalEntries.sourceId, id)));
    expect(lines.map((l) => [l.code, l.debit, l.credit]).sort()).toEqual(
      [
        ["2000", 0n, 40000n],
        ["6900", 40000n, 0n],
      ].sort(),
    );
    expect((await call(owner, "POST", `/vendor-credits/${id}/void`, { reason: "again" })).status).toBe(400);
  });

  it("refuses while anything is applied or refunded", async () => {
    const id = await recordedCredit();
    await json(await call(owner, "POST", `/vendor-credits/${id}/refunds`, { amount: "100", date: "2026-10-04", method: "cash" }));
    const created = await json<{ id: string }>(await call(owner, "POST", "/vendor-bills", { contactId: vendorId, billNumber: "88213", date: "2026-09-01", currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: "10000" }] }));
    await json(await call(owner, "POST", `/vendor-bills/${created.id}/record`));
    await json(await call(owner, "POST", `/vendor-credits/${id}/apply`, { allocations: [{ billId: created.id, amount: "500" }] }));
    const res = await call(owner, "POST", `/vendor-credits/${id}/void`, { reason: "Mistake" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Remove its 2 applications and refunds first.");
  });

  it("needs a reason and the void right", async () => {
    const id = await recordedCredit();
    expect((await call(owner, "POST", `/vendor-credits/${id}/void`, { reason: " " })).status).toBe(400);
    expect((await call(staff, "POST", `/vendor-credits/${id}/void`, { reason: "Mistake" })).status).toBe(403);
  });
});
