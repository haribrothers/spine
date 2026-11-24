import { randomUUID } from "node:crypto";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, invoiceLines, invoices, member, settings, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService } from "../email/email.service";
import { InvoicePdfDocument, type InvoicePdfData } from "../pdf/invoice-pdf.template";
import { InvoiceEmailWorker } from "./invoice-email.worker";
import { InvoicesService } from "./invoices.service";

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
 * US-INV-15 — payment instructions print under the totals on the invoice
 * PDF and in the invoice email, as they were when the invoice was issued.
 * Requires local Postgres.
 */
describe("US-INV-15 · print payment instructions on invoices (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-15-${randomUUID()}@example.com`;
  let orgId: string;
  let userId: string;
  let contactId: string;
  let invoicesService: InvoicesService;
  const INSTRUCTIONS = "Bank transfer to Riverstone Builders LLC\nAccount 0042 1188 0193 · Routing 211 274 450";

  const setInstructions = (paymentInstructions?: string) =>
    db
      .insert(settings)
      .values({ orgId, key: "business_profile", value: { name: "Riverstone Builders", paymentInstructions } })
      .onConflictDoUpdate({ target: [settings.orgId, settings.key], set: { value: { name: "Riverstone Builders", paymentInstructions } } });

  async function draft() {
    return invoicesService.create(
      orgId,
      userId,
      createInvoiceSchema.parse({ contactId, currency: "USD", lines: [{ name: "Kitchen fit-out", quantity: 1, unitPriceAmount: "220000", taxRatePercentage: 0 }] }),
    );
  }

  async function pdfText(invoiceId: string, business: InvoicePdfData["business"]) {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
    return textOf(InvoicePdfDocument({ invoice: invoice!, lines, contactName: "Alan Brooks", contactEmail: null, business }));
  }

  const alanEmail = `alan-${randomUUID()}@example.com`;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    userId = (await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" })).userId;
    orgId = (await db.select().from(member).where(eq(member.userId, userId)))[0]!.organizationId;
    const [contact] = await db
      .insert(contacts)
      .values({ orgId, type: "customer", name: "Alan Brooks", email: alanEmail, createdByUserId: userId })
      .returning();
    contactId = contact!.id;
    invoicesService = testApp.app.get(InvoicesService);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  it("an issued invoice keeps the instructions set when it was issued", async () => {
    await setInstructions(INSTRUCTIONS);
    const issued = await invoicesService.issue(orgId, (await draft()).id, userId);
    await setInstructions("Pay in cash only.");
    const [row] = await db.select().from(invoices).where(eq(invoices.id, issued.id));
    expect(row!.paymentInstructions).toBe(INSTRUCTIONS);
  });

  it("the PDF shows a 'How to pay' block under the totals, before the notes", async () => {
    await setInstructions(INSTRUCTIONS);
    const issued = await invoicesService.issue(orgId, (await draft()).id, userId);
    await setInstructions("Pay in cash only.");
    const text = await pdfText(issued.id, { name: "Riverstone Builders", paymentInstructions: "Pay in cash only." });
    const howToPay = text.indexOf("How to pay");
    expect(howToPay).toBeGreaterThan(text.lastIndexOf("Total"));
    expect(text[howToPay + 1]).toBe(INSTRUCTIONS);
    expect(text).not.toContain("Pay in cash only.");
  });

  it("a draft's preview shows the current setting", async () => {
    await setInstructions("Pay in cash only.");
    const text = await pdfText((await draft()).id, { name: "Riverstone Builders", paymentInstructions: "Pay in cash only." });
    expect(text).toContain("Pay in cash only.");
  });

  it("with no instructions, no empty block appears", async () => {
    await setInstructions(undefined);
    const issued = await invoicesService.issue(orgId, (await draft()).id, userId);
    expect(await pdfText(issued.id, { name: "Riverstone Builders" })).not.toContain("How to pay");
  });

  it("the invoice email shows the same instructions in a 'How to pay' box", async () => {
    await setInstructions(INSTRUCTIONS);
    const issued = await invoicesService.issue(orgId, (await draft()).id, userId);
    const emailService = testApp.app.get(EmailService);
    vi.spyOn(emailService, "isConfigured").mockReturnValue(true);
    const send = vi.spyOn(emailService, "send").mockResolvedValue();
    await testApp.app.get(InvoiceEmailWorker).process({ orgId, invoiceId: issued.id });
    // This invoice's email: the queue is shared by every test file, so another file's leftover email can be sent too.
    const sent = send.mock.calls.map(([mail]) => mail).find((mail) => mail.to === alanEmail)!;
    expect(sent.html).toContain("How to pay");
    expect(sent.html).toContain("Bank transfer to Riverstone Builders LLC<br>Account 0042 1188 0193");
    expect(sent.html!.indexOf("How to pay")).toBeLessThan(sent.html!.indexOf("The invoice is attached as a PDF."));
    expect(sent.text).toContain(`How to pay:\n${INSTRUCTIONS}`);
  });
});
