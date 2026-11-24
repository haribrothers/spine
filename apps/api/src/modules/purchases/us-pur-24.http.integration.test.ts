import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, journalEntries, journalLines, jobs, member, session as sessionTable, taxRates, teamMemberships, teamPrivileges, teams, user, vendorBills } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };
type Credit = { id: string; number: string | null; status: string; totalAmount: string; balanceAmount: string; vendorReference: string; lines: unknown[] };

/**
 * US-PUR-24 (D-141) — a vendor credit drafts like a bill, records with a
 * VCR- number and posts P24 (Dr AP / Cr line accounts and input tax,
 * job-tagged). Requires local Postgres.
 */
describe("US-PUR-24 · record a credit from a vendor (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let vendorId: string;
  let otherVendorId: string;
  let jobId: string;
  let code: Record<string, string>;
  let gstId: string;
  const owner: Who = { cookie: "", userId: "" };
  const drafter: Who = { cookie: "", userId: "" };
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
  const draft = (who: Who, extra: Record<string, unknown> = {}) =>
    call(who, "POST", "/vendor-credits", {
      contactId: vendorId,
      vendorReference: "CN-4471",
      jobId,
      date: "2026-10-03",
      currency: "USD",
      lines: [
        { type: "item", name: "Returned: treated pine 90×45", quantity: 20, unitPriceAmount: "1892", accountId: code["5000"], taxRateId: gstId },
        { type: "item", name: "Overcharged delivery", quantity: 1, unitPriceAmount: "5000", accountId: code["6300"] },
      ],
      ...extra,
    });

  async function newUser(name: string): Promise<Who> {
    const email = `us-pur-24-${name}-${randomUUID()}@example.com`;
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
    Object.assign(drafter, await newUser("drafter"));
    await join(drafter, "staff", ["vendor_credits.open", "vendor_credits.edit_own"]);
    Object.assign(field, await newUser("field"));
    await join(field, "field");
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    vendorId = vendor!.id;
    const [other] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Harbor Plant Hire", createdByUserId: owner.userId }).returning();
    otherVendorId = other!.id;
    const [job] = await db.insert(jobs).values({ orgId, contactId: vendorId, name: "Harbour Lofts fit-out", number: `J-${randomUUID().slice(0, 4)}`, currency: "USD", createdByUserId: owner.userId }).returning();
    jobId = job!.id;
    code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const [gst] = await db.insert(taxRates).values({ orgId, name: "Sales Tax 8.875%", rate: 8.875 }).returning();
    gstId = gst!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("records with the next VCR- number and posts P24, job-tagged", async () => {
    const created = await json<Credit>(await draft(owner));
    expect(created).toMatchObject({ status: "draft", number: null, vendorReference: "CN-4471", totalAmount: String(37840 + 3358 + 5000) });
    const recorded = await json<Credit>(await call(owner, "POST", `/vendor-credits/${created.id}/record`));
    expect(recorded).toMatchObject({ status: "open", number: "VCR-0001", balanceAmount: recorded.totalAmount });

    const lines = await db
      .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit, jobId: journalLines.jobId, contactId: journalLines.contactId })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(and(eq(journalEntries.sourceType, "vendor_credit"), eq(journalEntries.sourceId, created.id)));
    expect(lines.map((l) => [l.code, l.debit, l.credit]).sort()).toEqual(
      [
        ["2000", 46198n, 0n],
        ["5000", 0n, 37840n],
        ["6300", 0n, 5000n],
        ["1200", 0n, 3358n],
      ].sort(),
    );
    expect(new Set(lines.map((l) => l.jobId))).toEqual(new Set([jobId]));
    expect(new Set(lines.map((l) => l.contactId))).toEqual(new Set([vendorId]));

    // A recorded credit can't be edited or deleted.
    expect((await call(owner, "PUT", `/vendor-credits/${created.id}`, { vendorReference: "X" })).status).toBe(400);
    expect((await call(owner, "DELETE", `/vendor-credits/${created.id}`)).status).toBe(400);
  });

  it("'Against bill' must be one of this vendor's recorded bills", async () => {
    const [theirs] = await db.insert(vendorBills).values({ orgId, contactId: otherVendorId, status: "recorded", billNumber: "77", date: new Date(), currency: "USD", totalAmount: 100n, createdByUserId: owner.userId }).returning();
    const res = await draft(owner, { billId: theirs!.id });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toBe("Choose one of this vendor's recorded bills.");
    const [mine] = await db.insert(vendorBills).values({ orgId, contactId: vendorId, status: "recorded", billNumber: "88213", date: new Date(), currency: "USD", totalAmount: 100n, createdByUserId: owner.userId }).returning();
    expect((await draft(owner, { billId: mine!.id })).status).toBe(201);
  });

  it("the list shows number, vendor's number, vendor, status and balance", async () => {
    const rows = await json<{ number: string | null; vendorReference: string; contactName: string; status: string; balanceAmount: string }[]>(await call(owner, "GET", "/vendor-credits"));
    expect(rows.some((r) => r.number === "VCR-0001" && r.status === "open" && r.contactName === "Coastal Timber Supply")).toBe(true);
    expect((await json<unknown[]>(await call(owner, "GET", "/vendor-credits?status=draft"))).length).toBe(1);
  });

  it("Staff without 'Record vendor credits' draft but can't record; Field get 403", async () => {
    const mine = await json<Credit>(await draft(drafter));
    expect((await call(drafter, "POST", `/vendor-credits/${mine.id}/record`)).status).toBe(403);
    expect((await call(field, "GET", "/vendor-credits")).status).toBe(403);
    expect((await draft(field)).status).toBe(403);
  });
});
