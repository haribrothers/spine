import { randomUUID } from "node:crypto";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema, createPaymentSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { addresses, contacts, invoices, member, user } from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";
import { PaymentsService } from "../payments/payments.service";
import { QueueService } from "../queue/queue.service";
import { StatementPdfDocument, statementPeriodLabel } from "./statement-pdf.template";
import { StatementsService } from "./statements.service";

/** Every string a react-pdf element tree would print, in order. */
function textOf(node: ReactNode): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textOf);
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    if (typeof element.type === "function") return textOf((element.type as (p: unknown) => ReactNode)(element.props));
    return textOf(element.props.children);
  }
  return [];
}

/**
 * US-PAY-15 — the statement PDF: header, the table from the opening
 * balance, the aging strip, "How to pay", and the open-invoices-only view.
 * Requires local Postgres.
 */
describe("US-PAY-15 · give customers a clear statement PDF (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-pay-15-${randomUUID()}@example.com`;
  let orgId: string;
  let userId: string;
  let contactId: string;
  let statements: StatementsService;
  const today = orgClock().date;
  const from = `${today.slice(0, 4)}-01-01`;
  const numbers: Record<string, string> = {};
  const business = { name: "Riverstone Builders", address: "12 Quarry Lane, Portland, ME 04101" };
  const INSTRUCTIONS = "Bank transfer to Riverstone Builders LLC · Account 0042 1188 0193";

  async function pdfText(mode: "open" | "all", withInstructions = true) {
    const statement = await statements.build(orgId, contactId, { from, to: today, mode });
    return textOf(StatementPdfDocument({ statement, business: { ...business, ...(withInstructions ? { paymentInstructions: INSTRUCTIONS } : {}) } }));
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    userId = (await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" })).userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: userId }).returning();
    contactId = contact!.id;
    await db.insert(addresses).values({ contactId, type: "billing", line1: "220 Ridge Rd", city: "Burlington", state: "VT", postalCode: "05401", isPrimary: true });
    statements = testApp.app.get(StatementsService);

    const invoicesService = testApp.app.get(InvoicesService);
    const issue = async (amount: string, label: string, dueDaysAgo: number) => {
      const draft = await invoicesService.create(orgId, userId, createInvoiceSchema.parse({ contactId, currency: "USD", lines: [{ name: label, quantity: 1, unitPriceAmount: amount }] }));
      const invoice = await invoicesService.issue(orgId, draft.id, userId);
      const due = new Date(`${today}T00:00:00Z`);
      due.setUTCDate(due.getUTCDate() - dueDaysAgo);
      await db.update(invoices).set({ dueDate: due }).where(eq(invoices.id, invoice.id));
      numbers[label] = invoice.number!;
      return invoice;
    };
    const paid = await issue("875000", "Paid", 10);
    await issue("454250", "Overdue", 45);
    await issue("120000", "Current", -14);
    const payment = await testApp.app
      .get(PaymentsService)
      .create(orgId, userId, createPaymentSchema.parse({ contactId, date: today, method: "bank_transfer", currency: "USD", amount: "875000", allocations: [{ invoiceId: paid.id, amount: "875000" }] }));
    numbers.payment = payment.number!;
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("the header shows the business, STATEMENT, the period, 'Statement for' the customer with address, and the balance due", async () => {
    const text = await pdfText("all");
    expect(text.slice(0, 8)).toEqual([
      "RB",
      "Riverstone Builders",
      "12 Quarry Lane, Portland, ME 04101",
      "STATEMENT",
      statementPeriodLabel(from, today),
      "Statement for",
      "Maple Ridge Developments",
      "220 Ridge Rd, Burlington, VT 05401",
    ]);
    expect(text.slice(8, 10)).toEqual(["Balance due", "$5,742.50"]);
  });

  it("the table has Date, Reference, Type, Charges, Payments and Balance, starting with the opening balance", async () => {
    const text = await pdfText("all");
    const head = text.indexOf("Date");
    expect(text.slice(head, head + 8)).toEqual(["Date", "Reference", "Type", "Charges", "Payments", "Balance", "Opening balance", "$0.00"]);
    for (const ref of [numbers.Paid, numbers.Overdue, numbers.Current, numbers.payment]) expect(text).toContain(ref);
    expect(text).toContain("Payment");
  });

  it("the aging strip shows Current, 1–30, 31–60, 61–90 and 90+ days for what's still owed", async () => {
    const text = await pdfText("all");
    const strip = text.indexOf("Current");
    expect(text.slice(strip, strip + 10)).toEqual(["Current", "$1,200.00", "1–30 days", "$0.00", "31–60 days", "$4,542.50", "61–90 days", "$0.00", "90+ days", "$0.00"]);
  });

  it("with payment instructions set, a 'How to pay' block appears at the bottom; without, none", async () => {
    const withBlock = await pdfText("all");
    expect(withBlock.slice(-2)).toEqual(["How to pay", INSTRUCTIONS]);
    expect(await pdfText("all", false)).not.toContain("How to pay");
  });

  it("'Open invoices only' leaves out paid invoices and their payments, and the opening balance", async () => {
    const text = await pdfText("open");
    expect(text).not.toContain("Opening balance");
    expect(text).not.toContain(numbers.Paid);
    expect(text).not.toContain(numbers.payment);
    expect(text).toContain(numbers.Overdue);
    expect(text).toContain(numbers.Current);
    expect(text.slice(8, 10)).toEqual(["Balance due", "$5,742.50"]);
  });
});
