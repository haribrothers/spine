import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AI_NOT_ALLOWED_MESSAGE, AI_UNAVAILABLE_MESSAGE, type AiEmailDraft, type EmailDraft } from "@spine/shared";
import { createDb, type Database } from "../../../db/client";
import { aiRequests, member, session as sessionTable } from "../../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../../test-utils/test-app";
import { startAiStub, type AiStub } from "../../../test-utils/ai-stub";
import { EmailService } from "../../email/email.service";

type Who = { cookie: string; userId: string };

/** US-AI-11 — "Draft with AI" in the send dialogs. The provider is a stand-in; Spine's filling and checks are real. Requires local Postgres. */
describe("US-AI-11 · draft a customer email with AI (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let stub: AiStub;
  let teamId: string;
  let contactId: string;
  let invoice: { id: string; number: string };
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const fieldUser: Who = { cookie: "", userId: "" };
  const send = vi.fn();

  const callAs = (who: Who) => (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const call = callAs(owner);
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const refusal = async (res: Response) => ({ status: res.status, message: ((await res.json()) as { message: string }).message });
  const draft = (body: unknown, who: Who = owner) => callAs(who)("POST", "/ai/draft-email", body);
  const lastChat = () => stub.requests.filter((r) => r.path === "/v1/chat/completions").at(-1)!.body as { temperature: number; messages: { role: string; content: string }[] };
  const reminderReply = JSON.stringify({
    subject: "Invoice {document_number} {due_status}",
    message: "Hi {customer_name},\n\nInvoice {document_number} for {amount} was due on {due_date}, and {balance_due} is still outstanding.\n\nRegards,\n{business_name}",
  });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    vi.spyOn(testApp.app.get(EmailService), "isConfigured").mockReturnValue(true);
    vi.spyOn(testApp.app.get(EmailService), "send").mockImplementation(async (input) => void send(input));
    for (const [who, name] of [[owner, "Priya Raman"], [staff, "Kavya Iyer"], [fieldUser, "Marcus Webb"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-ai-11-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [fieldUser, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    const teams = await json<{ id: string; isDefault: boolean }[]>(await call("GET", "/org/teams"));
    teamId = teams.find((t) => t.isDefault)!.id;
    const staffMember = (await db.select().from(member).where(eq(member.userId, staff.userId)))[0]!;
    await json(await call("PUT", `/org/teams/${teamId}/members`, { memberIds: [staffMember.id] }));

    await json(await call("PUT", "/org/settings/business_profile", { value: { name: "Riverstone Builders" } }));
    contactId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Alan Brooks", email: "alan@example.com" }))).id;
    const created = await json<{ id: string }>(await call("POST", "/invoices", { contactId, currency: "USD", issueDate: "2026-08-01", dueDate: "2026-08-15", lines: [{ name: "Deck", quantity: 1, unitPriceAmount: "100000" }] }));
    invoice = await json<{ id: string; number: string }>(await call("POST", `/invoices/${created.id}/issue`));

    stub = await startAiStub();
    await json(await call("PUT", "/org/ai", { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3.5:4b", enabled: true }));
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await stub?.close();
    await testApp?.close();
  });

  it("the dialog opens with the template and lists the details Spine filled in, for the highlight", async () => {
    const opening = await json<EmailDraft>(await call("GET", `/email-drafts/reminder/${invoice.id}`));
    expect(opening.subject).toMatch(new RegExp(`^Reminder: invoice ${invoice.number} is \\d+ days overdue$`));
    expect(opening.values).toEqual(expect.arrayContaining([invoice.number, "Alan", "Riverstone Builders"]));
    expect(opening.values.find((v) => /^is \d+ days overdue$/.test(v))).toBeDefined();
  });

  it("drafts a reminder: the model's words with this invoice's own details, nothing sent", async () => {
    stub.setReply(reminderReply);
    const result = await json<AiEmailDraft>(await draft({ type: "reminder", documentId: invoice.id }));
    expect(result.subject).toMatch(new RegExp(`^Invoice ${invoice.number} is \\d+ days overdue$`));
    expect(result.message).toMatch(new RegExp(`^<p>Hi Alan,</p><p>Invoice ${invoice.number} for \\$1,000\\.00 was due on 15 Aug 2026, and \\$1,000\\.00 is still outstanding\\.</p><p>Regards,<br>Riverstone Builders</p>$`));
    // The same values as the template draft, so the highlight matches either.
    const opening = await json<EmailDraft>(await call("GET", `/email-drafts/reminder/${invoice.id}`));
    expect(result.values).toEqual(opening.values);

    // What the model got: the template and what each placeholder stands for, asked for variety.
    const chat = lastChat();
    expect(chat.temperature).toBe(0.7);
    const prompt = chat.messages.find((m) => m.role === "user")!.content;
    expect(prompt).toContain("Template subject: Reminder: invoice {document_number} {due_status}");
    expect(prompt).toContain("{balance_due} = $1,000.00");
    expect(prompt).not.toContain("{link}");

    const [request] = await db.select().from(aiRequests).where(and(eq(aiRequests.orgId, orgId), eq(aiRequests.feature, "draft_email"))).orderBy(desc(aiRequests.createdAt)).limit(1);
    expect(request).toMatchObject({ outcome: "ok", entityType: "invoice", entityId: invoice.id, userId: owner.userId });
    expect(send).not.toHaveBeenCalled();
  });

  it("a draft that strays from the invoice's details is refused as no answer, and recorded so", async () => {
    stub.setReply(JSON.stringify({ subject: "Invoice {document_number}", message: "Please pay $1,500.00 within 7 days." }));
    expect(await refusal(await draft({ type: "reminder", documentId: invoice.id }))).toEqual({ status: 503, message: AI_UNAVAILABLE_MESSAGE });
    stub.setReply(JSON.stringify({ subject: "Invoice {invoice_no}", message: "Hi {customer_name}" }));
    expect((await draft({ type: "reminder", documentId: invoice.id })).status).toBe(503);
    const [request] = await db.select().from(aiRequests).where(and(eq(aiRequests.orgId, orgId), eq(aiRequests.feature, "draft_email"))).orderBy(desc(aiRequests.createdAt)).limit(1);
    expect(request!.outcome).toBe("error");
  });

  it("quotes keep {link} and an unsent number for the send; statements draft from their period", async () => {
    const quote = await json<{ id: string }>(await call("POST", "/quotes", { contactId, currency: "USD", lines: [{ name: "Deck", quantity: 1, unitPriceAmount: "50000" }] }));
    stub.setReply(JSON.stringify({ subject: "Your quote {document_number}", message: "Hi {customer_name},\n\nHere's our quote for {amount}. Open it here: {link}" }));
    expect(await json<AiEmailDraft>(await draft({ type: "quote", documentId: quote.id }))).toMatchObject({
      subject: "Your quote {document_number}",
      message: "<p>Hi Alan,</p><p>Here&#39;s our quote for $500.00. Open it here: {link}</p>",
    });

    expect((await draft({ type: "statement", documentId: contactId })).status).toBe(400);
    stub.setReply(JSON.stringify({ subject: "Your statement for {document_number}", message: "Hi {customer_name},\n\n{balance_due} is due for {document_number}." }));
    const statement = await json<AiEmailDraft>(await draft({ type: "statement", documentId: contactId, from: "2026-01-01", to: "2026-12-31", mode: "all" }));
    expect(statement.message).toMatch(/^<p>Hi Alan,<\/p><p>\$1,000\.00 is due for .+2026\.<\/p>$/);
    const [request] = await db.select().from(aiRequests).where(and(eq(aiRequests.orgId, orgId), eq(aiRequests.feature, "draft_email"))).orderBy(desc(aiRequests.createdAt)).limit(1);
    expect(request).toMatchObject({ entityType: "contact", entityId: contactId });
  });

  it("only for someone who may use AI and send that email; another organisation's document isn't found", async () => {
    stub.setReply(reminderReply);
    expect(await refusal(await draft({ type: "reminder", documentId: invoice.id }, staff))).toEqual({ status: 403, message: AI_NOT_ALLOWED_MESSAGE });
    await json(await call("PUT", `/org/teams/${teamId}/privileges`, { privileges: [{ capability: "ai.use", granted: true }, { capability: "invoices.send_reminder", granted: false }] }));
    expect(await refusal(await draft({ type: "reminder", documentId: invoice.id }, staff))).toEqual({ status: 403, message: "You don't have permission to send this email." });
    await json(await call("PUT", `/org/teams/${teamId}/privileges`, { privileges: [{ capability: "invoices.send_reminder", granted: true }] }));
    expect((await draft({ type: "reminder", documentId: invoice.id }, staff)).status).toBe(200);

    expect((await draft({ type: "reminder", documentId: invoice.id }, fieldUser)).status).toBe(403);
    expect((await draft({ type: "invoice", documentId: randomUUID() })).status).toBe(404);
  });

  it("with the feature off, or AI off, there's no draft", async () => {
    await json(await call("PUT", "/org/ai", { features: { draftEmails: false } }));
    expect((await draft({ type: "reminder", documentId: invoice.id })).status).toBe(403);
    await json(await call("PUT", "/org/ai", { features: { draftEmails: true }, enabled: false }));
    expect((await draft({ type: "reminder", documentId: invoice.id })).status).toBe(403);
    await json(await call("PUT", "/org/ai", { enabled: true }));
  });
});
