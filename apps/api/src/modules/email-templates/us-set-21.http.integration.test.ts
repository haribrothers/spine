import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailDraft, MoneyAccount } from "@spine/shared";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { EmailService, type SendEmailInput } from "../email/email.service";
import { QueueService } from "../queue/queue.service";
import { INVOICE_SEND_EMAIL_QUEUE, InvoiceEmailWorker, type InvoiceSendEmailJobData } from "../invoices/invoice-email.worker";
import { QUOTE_SEND_EMAIL_QUEUE, QuoteEmailWorker, type QuoteSendEmailJobData } from "../quotes/quote-email.worker";

type Who = { cookie: string; userId: string };

/** US-SET-21 — my own words in each customer email, and the "Send" dialogs that start from them. Requires local Postgres. */
describe("US-SET-21 · edit the text of each customer email (requires local Postgres)", () => {
  let testApp: TestApp;
  const owner: Who = { cookie: "", userId: "" };
  let contactId: string;
  let invoiceId: string;
  let invoiceNumber: string;
  const sent: SendEmailInput[] = [];
  const queued: { name: string; data: unknown }[] = [];

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;
  /** Runs the email jobs queued so far, as the workers would. */
  const runQueued = async () => {
    for (const job of queued.splice(0)) {
      if (job.name === INVOICE_SEND_EMAIL_QUEUE) await testApp.app.get(InvoiceEmailWorker).process(job.data as InvoiceSendEmailJobData);
      if (job.name === QUOTE_SEND_EMAIL_QUEUE) await testApp.app.get(QuoteEmailWorker).process(job.data as QuoteSendEmailJobData);
    }
  };
  const last = () => sent.at(-1)!;

  beforeAll(async () => {
    testApp = await createTestApp();
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-set-21-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
    await json(await call("PUT", "/org/settings/business_profile", { value: { name: "Riverstone Builders" } }));
    vi.spyOn(testApp.app.get(EmailService), "isConfigured").mockReturnValue(true);
    vi.spyOn(testApp.app.get(EmailService), "send").mockImplementation(async (input: SendEmailInput) => {
      sent.push(input);
    });
    const queue = testApp.app.get(QueueService);
    const original = queue.send.bind(queue);
    vi.spyOn(queue, "send").mockImplementation(async (name, data, retry) => {
      if (name === INVOICE_SEND_EMAIL_QUEUE || name === QUOTE_SEND_EMAIL_QUEUE) {
        queued.push({ name, data });
        return;
      }
      return original(name, data, retry);
    });
    contactId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Alan Brooks", email: "alan@example.com" }))).id;
    const draft = await json<{ id: string }>(await call("POST", "/invoices", { contactId, currency: "USD", dueDate: "2027-01-15", lines: [{ name: "Kitchen", quantity: 1, unitPriceAmount: "100000" }] }));
    const issued = await json<{ id: string; number: string }>(await call("POST", `/invoices/${draft.id}/issue`));
    invoiceId = issued.id;
    invoiceNumber = issued.number;
  }, 120_000);

  beforeEach(() => {
    sent.length = 0;
    queued.length = 0;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
  });

  it("refuses a placeholder Spine doesn't know, or one the email doesn't have", async () => {
    const bad = await call("PUT", "/org/settings/email_templates", { value: { invoice: { subject: "Invoice {invoice_no}", body: "Hi" } } });
    expect(bad.status).toBe(400);
    expect(await message(bad)).toBe("{invoice_no} isn't a placeholder Spine knows. Use one from the list.");
    const noLink = await call("PUT", "/org/settings/email_templates", { value: { invoice: { subject: "Invoice", body: "Pay at {link}" } } });
    expect(noLink.status).toBe(400);
    expect(await message(noLink)).toBe("{link} isn't a placeholder Spine knows. Use one from the list.");
  });

  it("a saved template is what the next email says, inside the branded layout", async () => {
    const invoice = {
      subject: "Invoice {document_number} from {business_name}",
      body: "Hi {customer_name},\n\nYour invoice {document_number} for {amount} is attached. It's due on {due_date}.\n\nThanks for choosing us,\n{business_name}",
    };
    await json(await call("PUT", "/org/settings/email_templates", { value: { invoice } }));
    expect((await json<{ value: unknown }>(await call("GET", "/org/settings/email_templates"))).value).toEqual({ invoice });

    await json(await call("POST", `/invoices/${invoiceId}/send-email`));
    await runQueued();
    expect(last().to).toBe("alan@example.com");
    expect(last().subject).toBe(`Invoice ${invoiceNumber} from Riverstone Builders`);
    expect(last().html).toContain(`Your invoice ${invoiceNumber} for $1,000.00 is attached. It&#39;s due on 15 Jan 2027.`);
    expect(last().html).toContain("Thanks for choosing us,<br>Riverstone Builders");
    expect(last().html).toContain("Hi Alan,");
    // The layout around the words stays: the details and the PDF.
    expect(last().html).toContain("Balance due");
    expect(last().attachments?.some((a) => a.contentType === "application/pdf")).toBe(true);
  });

  it("the Send dialog starts from the template with this invoice's details, and can change one email", async () => {
    const draft = await json<EmailDraft>(await call("GET", `/email-drafts/invoice/${invoiceId}`));
    expect(draft).toMatchObject({ type: "invoice", to: "alan@example.com", subject: `Invoice ${invoiceNumber} from Riverstone Builders`, hasPdf: true });
    expect(draft.message).toContain(`Your invoice ${invoiceNumber} for $1,000.00 is attached.`);

    await json(await call("POST", `/invoices/${invoiceId}/send-email`, { to: "accounts@example.com", subject: "Your kitchen invoice", message: "Hello {customer_name},\n\nSee https://example.com/pay for ways to pay.", attachPdf: false }));
    await runQueued();
    expect(last()).toMatchObject({ to: "accounts@example.com", subject: "Your kitchen invoice" });
    expect(last().html).toContain('<a href="https://example.com/pay"');
    expect(last().attachments?.some((a) => a.contentType === "application/pdf")).toBe(false);
    // The saved template is unchanged for the next one.
    await json(await call("POST", `/invoices/${invoiceId}/send-email`));
    await runQueued();
    expect(last().subject).toBe(`Invoice ${invoiceNumber} from Riverstone Builders`);

    const bad = await call("POST", `/invoices/${invoiceId}/send-email`, { message: "Ref {invoice_no}" });
    expect(bad.status).toBe(400);
    expect(await message(bad)).toBe("{invoice_no} isn't a placeholder Spine knows. Use one from the list.");
  });

  it("reminders say when the invoice is due with {due_status}; Spine's default keeps today's wording", async () => {
    const draft = await json<{ id: string }>(await call("POST", "/invoices", { contactId, currency: "USD", issueDate: "2026-08-01", dueDate: "2026-08-15", lines: [{ name: "Deck", quantity: 1, unitPriceAmount: "10000" }] }));
    const overdue = await json<{ id: string; number: string }>(await call("POST", `/invoices/${draft.id}/issue`));
    expect((await json<EmailDraft>(await call("GET", `/email-drafts/reminder/${overdue.id}`))).subject).toMatch(new RegExp(`^Reminder: invoice ${overdue.number} is \\d+ days overdue$`));
    await json(await call("POST", `/invoices/${overdue.id}/send-reminder`));
    await runQueued();
    expect(last().subject).toMatch(new RegExp(`^Reminder: invoice ${overdue.number} is \\d+ days overdue$`));
    expect(last().html).toContain("This is a friendly reminder that invoice");
  });

  it("a quote's {link} becomes the link to the quote", async () => {
    await json(await call("PUT", "/org/settings/email_templates", { value: { quote: { subject: "Quote {document_number}", body: "Hi {customer_name},\n\nOpen it here: {link}" } } }));
    const quote = await json<{ id: string }>(await call("POST", "/quotes", { contactId, currency: "USD", lines: [{ name: "Deck", quantity: 1, unitPriceAmount: "50000" }] }));
    // The draft keeps {link}: the quote only gets its link when it's sent.
    expect((await json<EmailDraft>(await call("GET", `/email-drafts/quote/${quote.id}`))).message).toContain("Open it here: {link}");
    await json(await call("POST", `/quotes/${quote.id}/send`));
    await runQueued();
    expect(last().html).toMatch(/Open it here: <a href="http[^"]+\/quote\/[^"]+"/);
  });

  it("receipts, credit notes and statements use their templates", async () => {
    await json(
      await call("PUT", "/org/settings/email_templates", {
        value: {
          receipt: { subject: "Thanks for paying {amount}", body: "Hi {customer_name},\n\nWe got {amount}. Receipt {document_number} is attached." },
          credit_note: { subject: "Credit note {document_number}", body: "Hi {customer_name},\n\nWe've credited {amount}." },
          statement: { subject: "{business_name} statement", body: "Hi {customer_name},\n\nYou owe {balance_due} for {document_number}." },
        },
      }),
    );
    const bank = (await json<MoneyAccount[]>(await call("GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const payment = await json<{ id: string }>(await call("POST", "/payments", { contactId, date: "2026-10-01", method: "bank_transfer", currency: "USD", amount: "20000", moneyAccountId: bank.id, allocations: [{ invoiceId, amount: "20000" }] }));
    sent.length = 0;
    await json(await call("POST", `/payments/${payment.id}/send-receipt`));
    expect(last().subject).toBe("Thanks for paying $200.00");

    const credit = await json<{ id: string }>(await call("POST", "/credit-notes", { invoiceId, lines: [{ name: "Discount", quantity: 1, unitPriceAmount: "5000" }] }));
    const issued = await json<{ number: string }>(await call("POST", `/credit-notes/${credit.id}/issue`));
    expect((await json<EmailDraft>(await call("GET", `/email-drafts/credit_note/${credit.id}`))).subject).toBe(`Credit note ${issued.number}`);
    expect(await json<{ sentTo: string }>(await call("POST", `/credit-notes/${credit.id}/send-email`))).toEqual({ sentTo: "alan@example.com" });
    expect(last().subject).toBe(`Credit note ${issued.number}`);
    expect(last().html).toContain("We&#39;ve credited $50.00.");
    expect(last().attachments?.some((a) => a.contentType === "application/pdf")).toBe(true);

    const range = "from=2026-01-01&to=2026-12-31&mode=all";
    const statementDraft = await json<EmailDraft>(await call("GET", `/contacts/${contactId}/statement/draft?${range}`));
    expect(statementDraft.subject).toBe("Riverstone Builders statement");
    expect(statementDraft.message).toMatch(/You owe \$[\d,.]+ for /);
    await json(await call("POST", `/contacts/${contactId}/statement/send`, { from: "2026-01-01", to: "2026-12-31", mode: "all", email: "alan@example.com", subject: statementDraft.subject, message: statementDraft.message }));
    expect(last().subject).toBe("Riverstone Builders statement");
  });
});
