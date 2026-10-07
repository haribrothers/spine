import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, like, notLike } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OpeningBalancesView, OpeningBill, OpeningImportResult, OpeningVendorCredit } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, journalEntries, journalLines, member, session as sessionTable, teamMemberships, teams, user, vendorBills, vendorCredits } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-18 — opening vendor bills and vendor credits (P20). Requires local Postgres. */
describe("US-RPT-18 · bring in unpaid vendor bills and vendor credits (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let coastal: string;
  const ids = {} as Record<"bill" | "credit", string>;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  const liveLines = async (sourceId: string) =>
    db
      .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit, contactId: journalLines.contactId, date: journalEntries.date })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(and(eq(journalEntries.sourceId, sourceId), isNull(journalEntries.reversedById), like(journalEntries.sourceType, "opening\\_%"), notLike(journalEntries.sourceType, "%\\_repost")));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"]] as const) {
      const email = `us-rpt-18-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    coastal = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "vendor", name: "Coastal Timber Supply" }))).id;
    await json(await call(owner, "PUT", "/opening-balances", { cutoverDate: "2026-07-01", lines: [] }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("an opening bill posts P20 (Dr 3900 / Cr Accounts Payable for the vendor) and is a recorded bill", async () => {
    const bill = await json<OpeningBill>(await call(owner, "POST", "/opening-balances/bills", { contactId: coastal, billNumber: "88213", billDate: "2026-06-10", dueDate: "2026-07-10", amountDue: "691540" }));
    ids.bill = bill.id;
    expect(bill).toMatchObject({ contactName: "Coastal Timber Supply", billNumber: "88213", amountDue: "691540", balanceDue: "691540", hasActivity: false });
    expect((await liveLines(bill.id)).map((l) => [l.code, l.debit, l.credit, l.contactId, l.date]).sort()).toEqual(
      [["2000", 0n, 691540n, coastal, "2026-06-30"], ["3900", 691540n, 0n, null, "2026-06-30"]].sort(),
    );
    const [row] = await db.select().from(vendorBills).where(eq(vendorBills.id, bill.id));
    expect(row).toMatchObject({ status: "recorded", isOpening: true });
    const view = await json<OpeningBalancesView>(await call(owner, "GET", "/opening-balances"));
    expect(view.accounts.find((a) => a.code === "2000")!.fromDocuments).toMatchObject({ label: "From opening bills", debit: "0", credit: "691540" });
    expect(await message(await call(owner, "POST", "/opening-balances/bills", { contactId: coastal, billNumber: "88213", billDate: "2026-06-10", dueDate: "2026-07-10", amountDue: "1" }))).toBe(
      "Bill 88213 from Coastal Timber Supply is already in Spine. Enter each bill once.",
    );
  });

  it("an opening vendor credit posts P20 (Dr Accounts Payable / Cr 3900) and can be applied to the bill", async () => {
    const credit = await json<OpeningVendorCredit>(await call(owner, "POST", "/opening-balances/vendor-credits", { contactId: coastal, amount: "40000", vendorReference: "CN-4471" }));
    ids.credit = credit.id;
    expect(credit).toMatchObject({ number: "VCR-0001", vendorReference: "CN-4471", amount: "40000", available: "40000" });
    expect((await liveLines(credit.id)).map((l) => [l.code, l.debit, l.credit]).sort()).toEqual([["2000", 40000n, 0n], ["3900", 0n, 40000n]].sort());
    const [row] = await db.select().from(vendorCredits).where(eq(vendorCredits.id, credit.id));
    expect(row).toMatchObject({ status: "open", isOpening: true });
    await json(await call(owner, "POST", `/vendor-credits/${credit.id}/apply`, { allocations: [{ billId: ids.bill, amount: "10000" }] }));
    expect((await json<OpeningVendorCredit[]>(await call(owner, "GET", "/opening-balances/vendor-credits")))[0]!.available).toBe("30000");
    expect(await message(await call(owner, "DELETE", `/opening-balances/vendor-credits/${credit.id}`))).toBe("It has payments or credits against it. Remove those first.");
    expect(await message(await call(owner, "POST", `/vendor-credits/${credit.id}/void`, { reason: "x" }))).toBe("An opening vendor credit can't be voided. Remove it in Settings › Opening balances.");
  });

  it("the opening bill can be paid with a vendor payment, and then can't be changed", async () => {
    await json(await call(owner, "POST", "/vendor-payments", { contactId: coastal, date: "2026-07-05", method: "bank_transfer", currency: "USD", amount: "100000", allocations: [{ billId: ids.bill, amount: "100000" }] }));
    const bill = (await json<OpeningBill[]>(await call(owner, "GET", "/opening-balances/bills")))[0]!;
    expect(bill).toMatchObject({ balanceDue: "581540", hasActivity: true });
    expect(await message(await call(owner, "DELETE", `/opening-balances/bills/${ids.bill}`))).toBe("It has payments or credits against it. Remove those first.");
    expect(await message(await call(owner, "POST", `/vendor-bills/${ids.bill}/void`, { reason: "x" }))).toBe("An opening bill can't be voided. Remove it in Settings › Opening balances.");
  });

  it("imports bills from CSV, creating unmatched vendors on request", async () => {
    const rows = [
      { row: 2, vendor: "Harbour Plumbing", number: "HP-51", billDate: "2026-06-20", dueDate: "2026-07-20", amountDue: "45000" },
      { row: 3, vendor: "coastal timber supply", number: "88240", billDate: "2026-06-25", dueDate: "2026-07-25", amountDue: "" },
    ];
    expect(await json<OpeningImportResult>(await call(owner, "POST", "/opening-balances/bills/import", { rows }))).toEqual({ imported: 0, failed: [], unmatched: ["Harbour Plumbing"] });
    expect(await json<OpeningImportResult>(await call(owner, "POST", "/opening-balances/bills/import", { rows, createVendors: true }))).toEqual({ imported: 1, failed: [{ row: 3, reason: "Couldn't read the amount due." }], unmatched: [] });
    const [vendor] = await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.name, "Harbour Plumbing")));
    expect(vendor?.type).toBe("vendor");
  });

  it("moving the cutover date moves the opening bills and credits", async () => {
    await json(await call(owner, "PUT", "/opening-balances", { cutoverDate: "2026-07-03", lines: [] }));
    expect((await liveLines(ids.bill)).every((l) => l.date === "2026-07-02")).toBe(true);
    expect((await liveLines(ids.credit)).every((l) => l.date === "2026-07-02")).toBe(true);
  });

  it("Staff get 403", async () => {
    expect((await call(staff, "GET", "/opening-balances/bills")).status).toBe(403);
    expect((await call(staff, "POST", "/opening-balances/vendor-credits", { contactId: coastal, amount: "1" })).status).toBe(403);
  });
});
