import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema, createPaymentSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, invoiceLines, journalLines, member, payments, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";
import { PaymentsService } from "./payments.service";

/**
 * US-PAY-13 — a deposit is recorded against the advance invoice that
 * requested it: the request shows paid, the money is held in 2200 Customer
 * Advances, and it can later be applied to the final invoice. Requires
 * local Postgres.
 */
describe("US-PAY-13 · allocate a deposit payment to its advance invoice (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-pay-13-${randomUUID()}@example.com`;
  let orgId: string;
  let userId: string;
  let contactId: string;
  let invoicesService: InvoicesService;
  let paymentsService: PaymentsService;

  async function issuedInvoice(type: "advance" | "standard", amountMinor: bigint, taxPercent: number) {
    const draft = await invoicesService.create(
      orgId,
      userId,
      createInvoiceSchema.parse({
        contactId,
        type,
        currency: "USD",
        lines: [{ name: type === "advance" ? "Deposit" : "Kitchen fit-out", quantity: 1, unitPriceAmount: amountMinor.toString(), taxRatePercentage: taxPercent }],
      }),
    );
    return invoicesService.issue(orgId, draft.id, userId);
  }

  async function pay(amountMinor: bigint, allocations: { invoiceId: string; amount: bigint }[]) {
    return paymentsService.create(
      orgId,
      userId,
      createPaymentSchema.parse({ contactId, date: new Date(), method: "bank_transfer", currency: "USD", amount: amountMinor.toString(), allocations }),
    );
  }

  async function postingOf(paymentId: string) {
    const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
    const rows = await db
      .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(eq(journalLines.entryId, payment!.journalEntryId!));
    return rows.map((r) => ({ code: r.code, debit: r.debit, credit: r.credit })).sort((a, b) => a.code.localeCompare(b.code));
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Deposit Owner" });
    userId = owner.userId;
    const [m] = await db.select().from(member).where(eq(member.userId, userId));
    orgId = m!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Priya Nair", createdByUserId: userId }).returning();
    contactId = contact!.id;
    invoicesService = testApp.app.get(InvoicesService);
    paymentsService = testApp.app.get(PaymentsService);
  });

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("accepts a 5,000.00 deposit allocated to the advance invoice, which then shows Paid", async () => {
    const advance = await issuedInvoice("advance", 500000n, 0);
    const payment = await pay(500000n, [{ invoiceId: advance.id, amount: 500000n }]);
    const after = await invoicesService.getOne(orgId, advance.id);
    expect(after.paymentStatus).toBe("paid");
    expect(after.balanceDue).toBe(0n);

    // P5a: Bank Dr 5,000.00, 2200 Customer Advances Cr 5,000.00, no AR line.
    expect(await postingOf(payment.id)).toEqual([
      { code: "1010", debit: 500000n, credit: 0n },
      { code: "2200", debit: 0n, credit: 500000n },
    ]);

    // The deposit is still credit, available for a later invoice.
    expect(payment.unallocatedAmount).toBe(500000n);
  });

  it("a 2,000.00 part-payment leaves the advance invoice Partially paid with 3,000.00 outstanding", async () => {
    const advance = await issuedInvoice("advance", 500000n, 0);
    await pay(200000n, [{ invoiceId: advance.id, amount: 200000n }]);
    const after = await invoicesService.getOne(orgId, advance.id);
    expect(after.paymentStatus).toBe("partially_paid");
    expect(after.balanceDue).toBe(300000n);
  });

  it("applying the deposit to the final invoice debits 2200 and credits AR (P6)", async () => {
    const advance = await issuedInvoice("advance", 500000n, 0);
    const deposit = await pay(500000n, [{ invoiceId: advance.id, amount: 500000n }]);
    const final = await issuedInvoice("standard", 2000000n, 10);

    await paymentsService.applyCredit(orgId, userId, deposit.id, { allocations: [{ invoiceId: final.id, amount: 500000n }] });

    const credits = await db
      .select({ code: accounts.code, debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(and(eq(accounts.orgId, orgId), eq(journalLines.contactId, contactId)));
    expect(credits.some((l) => l.code === "2200" && l.debit === 500000n)).toBe(true);
    expect(credits.some((l) => l.code === "1100" && l.credit === 500000n)).toBe(true);
    expect((await invoicesService.getOne(orgId, final.id)).balanceDue).toBe(2200000n - 500000n);
  });

  it("the deposit invoice carries no tax; the final invoice's lines carry the full tax", async () => {
    const advance = await issuedInvoice("advance", 500000n, 10);
    expect(advance.taxAmount).toBe(0n);
    const [line] = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, advance.id));
    expect(line?.taxRatePercentage).toBe(0);
    const final = await issuedInvoice("standard", 2000000n, 10);
    expect(final.taxAmount).toBe(200000n);
  });

  it("offers an open advance invoice in the oldest-first suggestion", async () => {
    const advance = await issuedInvoice("advance", 100000n, 0);
    const suggestion = await paymentsService.suggestAllocation(orgId, contactId, 10_000_000n);
    expect(suggestion.allocations.map((a) => a.invoiceId)).toContain(advance.id);
  });

  it("won't delete a payment that paid an advance invoice", async () => {
    const advance = await issuedInvoice("advance", 100000n, 0);
    const payment = await pay(100000n, [{ invoiceId: advance.id, amount: 100000n }]);
    await expect(paymentsService.delete(orgId, payment.id, userId)).rejects.toThrow("Cannot delete a payment that has been allocated to an invoice");
  });
});
