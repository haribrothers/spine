import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, like, notLike } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OpeningBalancesView, OpeningCustomerCredit, OpeningImportResult, OpeningInvoice } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, invoices, journalEntries, journalLines, member, session as sessionTable, teamMemberships, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-17 — opening customer invoices (P18, with retention) and customer credit (P19). Requires local Postgres. */
describe("US-RPT-17 · bring in unpaid customer invoices, retention and credit (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let maple: string;
  let bluewater: string;
  let jobId: string;
  const ids = {} as Record<"rb2291" | "rb2304" | "credit", string>;
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
    (
      await db
        .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit, contactId: journalLines.contactId, jobId: journalLines.jobId, date: journalEntries.date })
        .from(journalLines)
        .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
        .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
        .where(and(eq(journalEntries.sourceId, sourceId), isNull(journalEntries.reversedById), like(journalEntries.sourceType, "opening\\_%"), notLike(journalEntries.sourceType, "%\\_repost")))
    );

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"]] as const) {
      const email = `us-rpt-17-${name}-${randomUUID()}@example.com`;
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

    maple = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Maple Ridge Developments" }))).id;
    bluewater = (await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Bluewater Hospitality Group" }))).id;
    jobId = (await json<{ id: string }>(await call(owner, "POST", "/jobs", { contactId: bluewater, name: "Hotel lobby refurb", currency: "USD" }))).id;
    await json(await call(owner, "PUT", "/opening-balances", { cutoverDate: "2026-07-01", lines: [] }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("an opening invoice posts P18 to receivables (and retention, tagged with its job) against 3900", async () => {
    const plain = await json<OpeningInvoice>(await call(owner, "POST", "/opening-balances/invoices", { contactId: maple, number: "RB-2291", invoiceDate: "2026-05-28", dueDate: "2026-06-27", amountDue: "875000" }));
    ids.rb2291 = plain.id;
    expect(plain).toMatchObject({ number: "RB-2291", contactName: "Maple Ridge Developments", amountDue: "875000", retentionHeld: "0", balanceDue: "875000", job: null });
    expect((await liveLines(plain.id)).map((l) => [l.code, l.debit, l.credit, l.date]).sort()).toEqual([["1100", 875000n, 0n, "2026-06-30"], ["3900", 0n, 875000n, "2026-06-30"]].sort());

    const held = await json<OpeningInvoice>(
      await call(owner, "POST", "/opening-balances/invoices", { contactId: bluewater, number: "RB-2304", invoiceDate: "2026-06-12", dueDate: "2026-07-12", amountDue: "604000", retentionHeld: "260000", jobId }),
    );
    ids.rb2304 = held.id;
    expect(held).toMatchObject({ amountDue: "604000", retentionHeld: "260000", balanceDue: "604000", job: { id: jobId, name: "Hotel lobby refurb" } });
    const lines = await liveLines(held.id);
    expect(lines.find((l) => l.code === "1150")).toMatchObject({ debit: 260000n, jobId, contactId: bluewater });
    expect(lines.find((l) => l.code === "3900")!.credit).toBe(864000n);

    const view = await json<OpeningBalancesView>(await call(owner, "GET", "/opening-balances"));
    expect(view.accounts.find((a) => a.code === "1100")!.fromDocuments).toMatchObject({ debit: "1479000" });
    expect(view.accounts.find((a) => a.code === "1150")!.fromDocuments).toMatchObject({ debit: "260000" });
  });

  it("refuses a number already used, and a date on or after the cutover date", async () => {
    const dup = await call(owner, "POST", "/opening-balances/invoices", { contactId: maple, number: "rb-2291", invoiceDate: "2026-05-28", dueDate: "2026-06-27", amountDue: "100" });
    expect(dup.status).toBe(409);
    expect(await message(dup)).toBe("Invoice rb-2291 already exists. Use the number from your old system exactly once.");
    const late = await call(owner, "POST", "/opening-balances/invoices", { contactId: maple, number: "RB-9999", invoiceDate: "2026-07-01", dueDate: "2026-07-31", amountDue: "100" });
    expect(await message(late)).toBe("An opening invoice is dated before the cutover date (Jul 1, 2026).");
  });

  it("is an issued invoice of type opening: payable, but no PDF", async () => {
    const [row] = await db.select().from(invoices).where(eq(invoices.id, ids.rb2291));
    expect(row).toMatchObject({ type: "opening", status: "issued", number: "RB-2291", totalAmount: 875000n });
    const pdf = await call(owner, "GET", `/invoices/${ids.rb2291}/pdf`);
    expect(pdf.status).toBe(404);
    expect(await message(pdf)).toBe("An opening invoice has no PDF in Spine. Attach the original to the invoice instead.");
    await json(await call(owner, "POST", "/payments", { contactId: maple, date: "2026-07-05", method: "bank_transfer", currency: "USD", amount: "100000", allocations: [{ invoiceId: ids.rb2291, amount: "100000" }] }));
    const after = (await json<OpeningInvoice[]>(await call(owner, "GET", "/opening-balances/invoices"))).find((i) => i.id === ids.rb2291)!;
    expect(after).toMatchObject({ balanceDue: "775000", hasActivity: true });
    expect(await message(await call(owner, "DELETE", `/opening-balances/invoices/${ids.rb2291}`))).toBe("It has payments or credits against it. Remove those first.");
  });

  it("the job's retention release includes the opening retention", async () => {
    const release = await json<{ totalAmount: string }>(await call(owner, "POST", `/jobs/${jobId}/release-retention`));
    expect(release.totalAmount).toBe("260000");
  });

  it("opening customer credit posts P19 and can be used", async () => {
    const credit = await json<OpeningCustomerCredit>(await call(owner, "POST", "/opening-balances/customer-credits", { contactId: maple, amount: "60000" }));
    ids.credit = credit.id;
    expect(credit).toMatchObject({ contactName: "Maple Ridge Developments", amount: "60000", available: "60000" });
    expect((await liveLines(credit.id)).map((l) => [l.code, l.debit, l.credit, l.contactId]).sort()).toEqual([["2200", 0n, 60000n, maple], ["3900", 60000n, 0n, null]].sort());
    await json(await call(owner, "POST", `/payments/${credit.id}/apply-credit`, { allocations: [{ invoiceId: ids.rb2291, amount: "10000" }] }));
    expect((await json<OpeningCustomerCredit[]>(await call(owner, "GET", "/opening-balances/customer-credits")))[0]!.available).toBe("50000");
    expect(await message(await call(owner, "DELETE", `/payments/${credit.id}`))).toBe("This is opening credit. Remove it in Settings › Opening balances.");
    expect(await message(await call(owner, "POST", `/invoices/${ids.rb2291}/void`, { reason: "x" }))).toBe("An opening invoice can't be voided. Remove it in Opening balances, or issue a credit note.");
  });

  it("imports from CSV: unmatched customers first, then created on request; bad rows are listed", async () => {
    const rows = [
      { row: 2, customer: "Sunstone Retail Fitouts", number: "RB-2310", invoiceDate: "2026-06-20", dueDate: "2026-07-20", amountDue: "345000", retentionHeld: "150000", job: "Hotel lobby refurb" },
      { row: 3, customer: "maple ridge developments", number: "RB-2320", invoiceDate: "2026-06-21", dueDate: "2026-07-21", amountDue: "1000" },
      { row: 4, customer: "Maple Ridge Developments", number: "RB-2291", invoiceDate: "2026-06-21", dueDate: "2026-07-21", amountDue: "1000" },
      { row: 5, customer: "Maple Ridge Developments", number: "RB-2330", invoiceDate: "2026-06-21", dueDate: "2026-07-21", amountDue: "abc" },
    ];
    expect(await json<OpeningImportResult>(await call(owner, "POST", "/opening-balances/invoices/import", { rows }))).toEqual({ imported: 0, failed: [], unmatched: ["Sunstone Retail Fitouts"] });
    const result = await json<OpeningImportResult>(await call(owner, "POST", "/opening-balances/invoices/import", { rows, createCustomers: true }));
    expect(result).toEqual({
      imported: 2,
      failed: [
        { row: 4, reason: "Invoice RB-2291 already exists. Use the number from your old system exactly once." },
        { row: 5, reason: "Couldn't read the amount due." },
      ],
      unmatched: [],
    });
    expect((await db.select().from(contacts).where(and(eq(contacts.orgId, orgId), eq(contacts.name, "Sunstone Retail Fitouts")))).length).toBe(1);
  });

  it("moving the cutover date moves the opening entries", async () => {
    await json(await call(owner, "PUT", "/opening-balances", { cutoverDate: "2026-07-03", lines: [] }));
    expect((await liveLines(ids.rb2304)).every((l) => l.date === "2026-07-02")).toBe(true);
    expect((await liveLines(ids.credit)).every((l) => l.date === "2026-07-02")).toBe(true);
    const view = await json<OpeningBalancesView>(await call(owner, "GET", "/opening-balances"));
    expect(view.accounts.find((a) => a.code === "1100")!.fromDocuments!.debit).toBe("1825000");
  });

  it("Staff get 403", async () => {
    expect((await call(staff, "GET", "/opening-balances/invoices")).status).toBe(403);
    expect((await call(staff, "POST", "/opening-balances/customer-credits", { contactId: maple, amount: "1" })).status).toBe(403);
  });
});
