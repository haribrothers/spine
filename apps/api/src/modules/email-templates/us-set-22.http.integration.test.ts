import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DEFAULT_EMAIL_TEMPLATES, type EmailDraft } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService, type SendEmailInput } from "../email/email.service";

type Who = { cookie: string; userId: string };

/** US-SET-22 — preview an email, send a test to myself, reset to Spine's text. Requires local Postgres. */
describe("US-SET-22 · preview an email and reset it to the default (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  let ownerEmail: string;
  const sent: SendEmailInput[] = [];
  let configured = true;
  const text = { subject: "Invoice {document_number} from {business_name}", body: "Hi {customer_name},\n\nYour invoice {document_number} for {amount} is attached." };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const preview = (body: unknown, type = "invoice") => call(owner, "POST", `/org/settings/email_templates/${type}/preview`, body);

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    ownerEmail = `us-set-22-owner-${randomUUID()}@example.com`;
    Object.assign(owner, await signUp(testApp.baseUrl, { email: ownerEmail, password: "testpassword123", name: "Owner" }));
    Object.assign(staff, await signUp(testApp.baseUrl, { email: `us-set-22-staff-${randomUUID()}@example.com`, password: "testpassword123", name: "Staff" }));
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    await json(await call(owner, "PUT", "/org/settings/business_profile", { value: { name: "Riverstone Builders" } }));
    vi.spyOn(testApp.app.get(EmailService), "isConfigured").mockImplementation(() => configured);
    vi.spyOn(testApp.app.get(EmailService), "send").mockImplementation(async (input: SendEmailInput) => {
      sent.push(input);
    });
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
  });

  it("with no documents yet, the preview uses sample details in the branded layout", async () => {
    const result = await json<{ subject: string; html: string; source: string }>(await preview(text));
    expect(result).toMatchObject({ subject: "Invoice INV-0000 from Riverstone Builders", source: "Sample details" });
    expect(result.html).toContain("Your invoice INV-0000 for");
    expect(result.html).toContain("Balance due");
  });

  it("with a real invoice, the preview is made from the most recent one — text not yet saved", async () => {
    const contact = await json<{ id: string }>(await call(owner, "POST", "/contacts", { type: "customer", name: "Alan Brooks", email: "alan@example.com" }));
    const draft = await json<{ id: string }>(await call(owner, "POST", "/invoices", { contactId: contact.id, currency: "USD", lines: [{ name: "Kitchen", quantity: 1, unitPriceAmount: "100000" }] }));
    const invoice = await json<{ number: string }>(await call(owner, "POST", `/invoices/${draft.id}/issue`));
    const result = await json<{ subject: string; html: string; source: string }>(await preview(text));
    expect(result.subject).toBe(`Invoice ${invoice.number} from Riverstone Builders`);
    expect(result.source).toBe(`${invoice.number} · Alan Brooks`);
    expect(result.html).toContain(`Your invoice ${invoice.number} for $1,000.00 is attached.`);
    // A quote's preview has an example link, never a {link} placeholder.
    const quote = await json<{ html: string }>(await preview({ subject: "Quote", body: "Open {link}" }, "quote"));
    expect(quote.html).toMatch(/Open <a href="http[^"]+\/quote\/example"/);
    const bad = await preview({ subject: "Invoice {invoice_no}", body: "Hi" });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toBe("{invoice_no} isn't a placeholder Spine knows. Use one from the list.");
  });

  it("'Send me a test' emails the preview to me only", async () => {
    sent.length = 0;
    expect(await json<{ sentTo: string }>(await call(owner, "POST", "/org/settings/email_templates/invoice/test", text))).toEqual({ sentTo: ownerEmail });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(ownerEmail);
    expect(sent[0]!.subject).toMatch(/^\[Test\] Invoice INV-\d+ from Riverstone Builders$/);
    configured = false;
    const off = await call(owner, "POST", "/org/settings/email_templates/invoice/test", text);
    expect(off.status).toBe(503);
    expect(((await off.json()) as { message: string }).message).toBe("Email isn't set up yet, so a test can't be sent. Ask an Owner to set up email.");
    configured = true;
  });

  it("'Reset to default' brings back Spine's text", async () => {
    await json(await call(owner, "PUT", "/org/settings/email_templates", { value: { invoice: text } }));
    const invoiceId = ((await json<{ id: string }[]>(await call(owner, "GET", "/invoices")))[0]!).id;
    expect((await json<EmailDraft>(await call(owner, "GET", `/email-drafts/invoice/${invoiceId}`))).subject).toMatch(/^Invoice INV-\d+ from Riverstone Builders$/);
    // The pane saves without the reset email, so it follows the default again.
    await json(await call(owner, "PUT", "/org/settings/email_templates", { value: {} }));
    const draft = await json<EmailDraft>(await call(owner, "GET", `/email-drafts/invoice/${invoiceId}`));
    expect(draft.subject).toMatch(/^Riverstone Builders sent you an invoice \(INV-\d+\)$/);
    expect(DEFAULT_EMAIL_TEMPLATES.invoice.subject).toBe("{business_name} sent you an invoice ({document_number})");
  });

  it("only an Owner can preview or send a test", async () => {
    expect((await call(staff, "POST", "/org/settings/email_templates/invoice/preview", text)).status).toBe(403);
    expect((await call(staff, "POST", "/org/settings/email_templates/invoice/test", text)).status).toBe(403);
  });
});
