import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema, type CustomerRefund, type MoneyAccount, type Statement } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, journalEntries, journalLines, member, payments, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService } from "../email/email.service";
import { InvoicesService } from "../invoices/invoices.service";

type Who = { cookie: string; userId: string };

/**
 * US-PAY-17 — refunding a customer's credit posts P23, lowers the credit,
 * can be deleted (the credit comes back) and shows on the statement.
 * Requires local Postgres.
 */
describe("US-PAY-17 · refund a customer (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let contactId: string;
  let cash: MoneyAccount;
  let paymentId: string;
  const owner: Who = { cookie: "", userId: "" };
  const refunder: Who = { cookie: "", userId: "" };
  const plain: Who = { cookie: "", userId: "" };

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
  const refund = (who: Who, body: Record<string, unknown>) => call(who, "POST", "/customer-refunds", { date: "2026-10-01", method: "bank_transfer", moneyAccountId: cash.id, ...body });
  const unallocated = async () => (await json<{ unallocatedAmount: string }>(await call(owner, "GET", `/payments/${paymentId}`))).unallocatedAmount;
  async function linesOf(sourceType: string, sourceId: string) {
    const rows = await db
      .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalEntries.id, journalLines.entryId))
      .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
      .where(and(eq(journalEntries.sourceType, sourceType), eq(journalEntries.sourceId, sourceId)));
    return rows.map((r) => [r.code, r.debit, r.credit]).sort();
  }

  const contactEmail = `ap-${randomUUID()}@example.com`;
  /** This customer's email: the queue is shared by every test file, so another file's leftover email can be sent while the spy is on. */
  const sentTo = (send: { mock: { calls: [{ to: string; subject: string; text?: string }][] } }, to: string) => send.mock.calls.map(([mail]) => mail).find((mail) => mail.to === to)!;

  async function newUser(name: string): Promise<Who> {
    const email = `us-pay-17-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }
  async function join(who: Who, grants: string[]) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(refunder, await newUser("refunder"));
    await join(refunder, ["payments.refund"]);
    Object.assign(plain, await newUser("plain"));
    await join(plain, ["payments.edit_own"]);

    const [c] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", email: contactEmail, createdByUserId: owner.userId }).returning();
    contactId = c!.id;
    cash = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1000")!;
    // An overpayment: 500.00 held as credit.
    paymentId = (await json<{ id: string }>(await call(owner, "POST", "/payments", { contactId, date: "2026-09-20", method: "bank_transfer", currency: "USD", amount: "50000" }))).id;
  }, 120_000);

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("refunds part of a payment's credit: P23 posts, the credit drops, and a confirmation goes out", async () => {
    const send = vi.spyOn(testApp.app.get(EmailService), "send").mockResolvedValue(undefined);
    vi.spyOn(testApp.app.get(EmailService), "isConfigured").mockReturnValue(true);
    const res = await refund(refunder, { sourcePaymentId: paymentId, amount: "20000", reference: "RF-1", sendConfirmation: true });
    expect(res.status).toBe(201);
    const created = (await res.json()) as CustomerRefund;
    expect(created).toMatchObject({ contactName: "Maple Ridge Developments", amount: "20000", moneyAccount: { name: "Cash in Hand" }, source: { kind: "payment" }, confirmation: { sent: true } });
    expect(await linesOf("customer_refund", created.id)).toEqual(
      [
        ["2200", 20000n, 0n],
        ["1000", 0n, 20000n],
      ].sort(),
    );
    expect(await unallocated()).toBe("30000");
    const mail = sentTo(send as never, contactEmail);
    expect(mail.subject).toContain("refunded $200.00");
    expect(mail.text).toContain("We've refunded $200.00");
  });

  it("refuses more than the credit left, and credit already refunded can't be applied", async () => {
    const tooMuch = await refund(owner, { sourcePaymentId: paymentId, amount: "30001" });
    expect(tooMuch.status).toBe(400);
    expect(((await tooMuch.json()) as { message: string }).message).toBe("You can refund up to $300.00 from this payment.");
    const service = testApp.app.get(InvoicesService);
    const draft = await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: "100000" }] }));
    const invoice = await service.issue(orgId, draft.id, owner.userId);
    expect((await call(owner, "POST", `/payments/${paymentId}/apply-credit`, { allocations: [{ invoiceId: invoice.id, amount: "30001" }] })).status).toBe(400);
  });

  it("deleting a refund reverses it and the credit comes back; a refunded payment can't be deleted first", async () => {
    const created = await json<CustomerRefund>(await refund(owner, { sourcePaymentId: paymentId, amount: "10000" }));
    expect(await unallocated()).toBe("20000");
    const blocked = await call(owner, "DELETE", `/payments/${paymentId}`);
    expect(((await blocked.json()) as { message: string }).message).toBe("Delete this payment's refunds first.");

    expect((await call(owner, "DELETE", `/customer-refunds/${created.id}`)).status).toBe(200);
    expect(await unallocated()).toBe("30000");
    expect(await linesOf("customer_refund_delete", created.id)).toEqual(
      [
        ["2200", 0n, 10000n],
        ["1000", 10000n, 0n],
      ].sort(),
    );
    const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
    expect(p!.refundedAmount).toBe(20000n);
  });

  it("refunds a credit note's excess", async () => {
    const service = testApp.app.get(InvoicesService);
    const draft = await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: "10000" }] }));
    const invoice = await service.issue(orgId, draft.id, owner.userId);
    await json(await call(owner, "POST", "/payments", { contactId, date: "2026-09-21", method: "cash", currency: "USD", amount: "10000", allocations: [{ invoiceId: invoice.id, amount: "10000" }] }));
    const note = await json<{ id: string }>(await call(owner, "POST", "/credit-notes", { invoiceId: invoice.id, lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "4000", taxRatePercentage: 0 }] }));
    await json(await call(owner, "POST", `/credit-notes/${note.id}/issue`));
    const created = await json<CustomerRefund>(await refund(owner, { sourceCreditNoteId: note.id, amount: "4000" }));
    expect(created.source.kind).toBe("credit_note");
    expect((await json<{ creditRemainingAmount: string }>(await call(owner, "GET", `/credit-notes/${note.id}`))).creditRemainingAmount).toBe("0");
  });

  it("the statement shows refunds as charge lines", async () => {
    const statement = await json<Statement>(await call(owner, "GET", `/contacts/${contactId}/statement?from=2000-01-01&to=2100-12-31&mode=all`));
    const refunds = statement.rows.filter((r) => r.type === "Refund");
    expect(refunds.map((r) => r.charges)).toEqual(["20000", "10000", "4000"]);
    expect(statement.rows.filter((r) => r.type === "Refund removed").map((r) => r.payments)).toEqual(["10000"]);
  });

  it("needs payments.refund; listing is open to Staff", async () => {
    expect((await refund(plain, { sourcePaymentId: paymentId, amount: "100" })).status).toBe(403);
    const listed = await json<CustomerRefund[]>(await call(plain, "GET", `/customer-refunds?contactId=${contactId}`));
    // Newest first.
    expect(listed.map((r) => [r.amount, r.deletedAt === null])).toEqual([
      ["4000", true],
      ["10000", false],
      ["20000", true],
    ]);
  });
});
