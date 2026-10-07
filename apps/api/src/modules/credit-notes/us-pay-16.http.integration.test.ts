import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema, createPaymentSchema, type Statement } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, creditNotes, invoices, journalEntries, journalLines, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";
import { PaymentsService } from "../payments/payments.service";

type Who = { cookie: string; userId: string };

/**
 * US-PAY-16 (D-142) — a credit note beyond the invoice's balance keeps the
 * excess as customer credit (P8 to 2200), which can be applied to another
 * invoice (P6) and shows on the statement. Requires local Postgres.
 */
describe("US-PAY-16 · keep a credit note's extra as customer credit (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let contactId: string;
  let otherContactId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

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

  async function issuedInvoice(amount: string, contact = contactId) {
    const service = testApp.app.get(InvoicesService);
    const draft = await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: contact, currency: "USD", lines: [{ name: "Kitchen fit-out", quantity: 1, unitPriceAmount: amount }] }));
    return (await service.issue(orgId, draft.id, owner.userId)).id;
  }
  async function pay(invoiceId: string, amount: string) {
    await testApp.app.get(PaymentsService).create(orgId, owner.userId, createPaymentSchema.parse({ contactId, date: "2026-09-30", method: "bank_transfer", currency: "USD", amount, allocations: [{ invoiceId, amount }] }));
  }
  async function creditNote(invoiceId: string, amount: string, who: Who = owner) {
    const draft = await json<{ id: string }>(await call(who, "POST", "/credit-notes", { invoiceId, lines: [{ type: "item", name: "Returned fittings", quantity: 1, unitPriceAmount: amount, taxRatePercentage: 0 }] }));
    return call(who, "POST", `/credit-notes/${draft.id}/issue`);
  }
  async function linesOf(sourceType: string, sourceId: string) {
    const rows = await db
      .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(and(eq(journalEntries.sourceType, sourceType), eq(journalEntries.sourceId, sourceId)));
    return rows.map((r) => [r.code, r.debit, r.credit]).sort();
  }

  async function newUser(name: string): Promise<Who> {
    const email = `us-pay-16-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(staff, await newUser("staff"));
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of ["credit_notes.edit_own", "credit_notes.issue"]) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });

    const [c] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", email: `ap-${randomUUID()}@example.com`, createdByUserId: owner.userId }).returning();
    contactId = c!.id;
    const [other] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: owner.userId }).returning();
    otherContactId = other!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("crediting a fully paid invoice puts the whole credit in Customer Advances", async () => {
    const invoiceId = await issuedInvoice("100000");
    await pay(invoiceId, "100000");
    const issued = await json<{ id: string; creditRemainingAmount: string }>(await creditNote(invoiceId, "30000"));
    expect(issued.creditRemainingAmount).toBe("30000");
    expect(await linesOf("credit_note", issued.id)).toEqual(
      [
        ["4100", 30000n, 0n],
        ["2200", 0n, 30000n],
      ].sort(),
    );
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    expect(invoice!.creditedAmount).toBe(0n);
  });

  it("a credit above what's left to pay credits AR up to the balance and keeps the rest", async () => {
    const invoiceId = await issuedInvoice("100000");
    await pay(invoiceId, "80000");
    const issued = await json<{ id: string; creditRemainingAmount: string }>(await creditNote(invoiceId, "50000"));
    expect(issued.creditRemainingAmount).toBe("30000");
    expect(await linesOf("credit_note", issued.id)).toEqual(
      [
        ["4100", 50000n, 0n],
        ["1100", 0n, 20000n],
        ["2200", 0n, 30000n],
      ].sort(),
    );
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    expect(invoice!.totalAmount - invoice!.amountPaid - invoice!.creditedAmount).toBe(0n);

    // All the credit notes on one invoice can't exceed the invoice.
    const tooMuch = await creditNote(invoiceId, "50001");
    expect(tooMuch.status).toBe(400);
    expect(((await tooMuch.json()) as { message: string }).message).toBe("You can credit up to $500.00 on this invoice.");
  });

  it("the credit applies to another invoice (P6), never beyond its balance or the credit, never another customer's", async () => {
    const [note] = await db.select().from(creditNotes).where(and(eq(creditNotes.contactId, contactId), eq(creditNotes.creditRemainingAmount, 30000n))).limit(1);
    const target = await issuedInvoice("45425");
    const others = await issuedInvoice("10000", otherContactId);

    const tooMuch = await call(owner, "POST", `/credit-notes/${note!.id}/apply-credit`, { allocations: [{ invoiceId: target, amount: "30001" }] });
    expect(((await tooMuch.json()) as { message: string }).message).toBe("This credit note has $300.00 of credit to apply.");
    expect((await call(owner, "POST", `/credit-notes/${note!.id}/apply-credit`, { allocations: [{ invoiceId: others, amount: "100" }] })).status).toBe(400);
    expect((await call(staff, "POST", `/credit-notes/${note!.id}/apply-credit`, { allocations: [{ invoiceId: target, amount: "100" }] })).status).toBe(403);

    const applied = await json<{ creditRemainingAmount: string }>(await call(owner, "POST", `/credit-notes/${note!.id}/apply-credit`, { allocations: [{ invoiceId: target, amount: "30000" }] }));
    expect(applied.creditRemainingAmount).toBe("0");
    expect(await linesOf("credit_note_credit_applied", note!.id)).toEqual(
      [
        ["2200", 30000n, 0n],
        ["1100", 0n, 30000n],
      ].sort(),
    );
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, target));
    expect(invoice!.totalAmount - invoice!.amountPaid - invoice!.creditedAmount).toBe(15425n);
  });

  it("the statement shows the credit as a credit line; applying it adds no line", async () => {
    const statement = await json<Statement>(await call(owner, "GET", `/contacts/${contactId}/statement?from=2000-01-01&to=2100-12-31&mode=all`));
    const credits = statement.rows.filter((r) => r.type === "Credit note");
    expect(credits.map((r) => r.payments)).toEqual(["30000", "50000"]);
    expect(statement.rows.some((r) => r.type === "Credit applied")).toBe(false);
    // Owed: 15425 on the last invoice; held: the other credit note's 30000 not yet used.
    expect(statement.balanceDue).toBe("-14575");
  });
});
