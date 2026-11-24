import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QuoteActivityEntry, QuoteCustomerLink, QuoteRelated } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { pdfText } from "../../test-utils/pdf-text";

interface QuoteRow {
  id: string;
  title: string | null;
  number: string | null;
  status: string;
  version: number;
  validUntil: string | null;
  viewCount?: number;
  lastViewedAt?: string | null;
}

/**
 * US-QUO-29 to US-QUO-33 and US-QUO-36 (D-214) — quotes you can work from:
 * view counts in the list, a title, a customer link without an email, the
 * activity, what a quote is connected to, and the usual validity.
 * Requires local Postgres.
 */
describe("Quotes you can work from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-quo-29-${randomUUID()}@example.com`;
  const fieldEmail = `us-quo-29-field-${randomUUID()}@example.com`;
  let cookie: string;
  let fieldCookie: string;
  let contactId: string;

  const call = (method: string, route: string, body?: unknown, who = cookie) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => (await res.json()) as T;
  const line = { type: "item", name: "Tiling", quantity: 2, unitPriceAmount: "95000" };
  const newQuote = async (extra: Record<string, unknown> = {}) => json<QuoteRow>(await call("POST", "/quotes", { contactId, currency: "USD", lines: [line], ...extra }));
  const sendQuote = async (id: string) => json<QuoteRow>(await call("POST", `/quotes/${id}/send`, {}));
  const tokenOf = (url: string) => decodeURIComponent(url.split("/quote/")[1]!);

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Priya Raman" });
    cookie = owner.cookie;
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    contactId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Ananya Rao", email: "ananya@example.com" }))).id;
    const field = await signUp(testApp.baseUrl, { email: fieldEmail, password: "testpassword123", name: "Field" });
    fieldCookie = field.cookie;
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, fieldEmail]));
  });

  describe("US-QUO-30 · give a quote a title", () => {
    it("saves, edits and clears a title, refuses one over 120 characters, and copies it on duplicate and revise", async () => {
      const quote = await newQuote({ title: "  Bathroom refit — 2nd floor  " });
      expect(quote.title).toBe("Bathroom refit — 2nd floor");
      const tooLong = await call("POST", "/quotes", { contactId, currency: "USD", lines: [line], title: "x".repeat(121) });
      expect(tooLong.status).toBe(400);
      expect(JSON.stringify(await tooLong.json())).toContain("Keep the title under 120 characters.");

      expect((await json<QuoteRow>(await call("PUT", `/quotes/${quote.id}`, { title: "Bathroom refit" }))).title).toBe("Bathroom refit");
      const copy = await json<QuoteRow>(await call("POST", `/quotes/${quote.id}/duplicate`));
      expect(copy.title).toBe("Bathroom refit");
      expect((await json<QuoteRow>(await call("PUT", `/quotes/${copy.id}`, { title: "" }))).title).toBeNull();

      await sendQuote(quote.id);
      const v2 = await json<QuoteRow>(await call("POST", `/quotes/${quote.id}/revise`));
      expect(v2).toMatchObject({ version: 2, title: "Bathroom refit" });
    });
  });

  describe("US-QUO-31 · copy the customer link", () => {
    it("makes a working link for a sent quote without emailing, keeps earlier links working, and refuses a draft or a revised quote", async () => {
      const quote = await newQuote({ title: "Kitchen" });
      expect((await call("POST", `/quotes/${quote.id}/link`)).status).toBe(400);
      await sendQuote(quote.id);
      const first = await json<QuoteCustomerLink>(await call("POST", `/quotes/${quote.id}/link`));
      const second = await json<QuoteCustomerLink>(await call("POST", `/quotes/${quote.id}/link`));
      expect(first.url).toMatch(/\/quote\/.+/);
      expect(new Date(first.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
      for (const link of [first, second]) {
        const view = await fetch(`${testApp.baseUrl}/public/quotes/${encodeURIComponent(tokenOf(link.url))}`);
        expect(view.status).toBe(200);
        expect(((await view.json()) as { title: string | null }).title).toBe("Kitchen");
      }
      await call("POST", `/quotes/${quote.id}/revise`);
      const refused = await call("POST", `/quotes/${quote.id}/link`);
      expect(refused.status).toBe(400);
      expect(((await refused.json()) as { message: string }).message).toBe("Only a sent quote has a customer link.");
    });
  });

  describe("US-QUO-29 · read a quote's progress in the list", () => {
    it("counts the customer's views and when they last looked", async () => {
      const quote = await newQuote();
      await sendQuote(quote.id);
      let row = (await json<QuoteRow[]>(await call("GET", "/quotes"))).find((q) => q.id === quote.id)!;
      expect(row).toMatchObject({ viewCount: 0, lastViewedAt: null, lineNames: ["Tiling"] });
      const link = await json<QuoteCustomerLink>(await call("POST", `/quotes/${quote.id}/link`));
      for (let i = 0; i < 2; i++) await fetch(`${testApp.baseUrl}/public/quotes/${encodeURIComponent(tokenOf(link.url))}`);
      row = (await json<QuoteRow[]>(await call("GET", "/quotes"))).find((q) => q.id === quote.id)!;
      expect(row.viewCount).toBe(2);
      expect(row.lastViewedAt).not.toBeNull();
    });
  });

  describe("US-QUO-32 · follow what happened to a quote", () => {
    it("lists created, sent, link copied, viewed, accepted with the comment and the invoice made, newest first; Owner and Staff only", async () => {
      const quote = await newQuote();
      await sendQuote(quote.id);
      const link = await json<QuoteCustomerLink>(await call("POST", `/quotes/${quote.id}/link`));
      const token = tokenOf(link.url);
      await fetch(`${testApp.baseUrl}/public/quotes/${encodeURIComponent(token)}`);
      const accepted = await fetch(`${testApp.baseUrl}/public/quotes/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "Please start on the 20th." }),
      });
      expect(accepted.status).toBeLessThan(300);
      const invoice = await json<{ id: string }>(await call("POST", `/invoices/from-quote/${quote.id}`, {}));

      const activity = await json<QuoteActivityEntry[]>(await call("GET", `/quotes/${quote.id}/activity`));
      const types = activity.map((a) => a.type);
      for (const t of ["created", "sent", "link_copied", "viewed", "accepted"]) expect(types).toContain(t);
      expect(activity.find((a) => a.type === "accepted")).toMatchObject({ detail: "Please start on the 20th.", method: "public_link", actorName: "Ananya Rao" });
      expect(activity.find((a) => a.type === "sent")?.actorName).toBe("Priya Raman");
      expect(activity.find((a) => a.type === "converted_to_invoice")?.linkId).toBe(invoice.id);
      const times = activity.map((a) => a.at);
      expect([...times].sort().reverse()).toEqual(times);

      expect((await call("GET", `/quotes/${quote.id}/activity`, undefined, fieldCookie)).status).toBe(403);
    });
  });

  describe("US-QUO-33 · get to a quote's versions and what was made from it", () => {
    it("lists every version from any of them, and is Owner and Staff only", async () => {
      const v1 = await newQuote();
      await sendQuote(v1.id);
      const v2 = await json<QuoteRow>(await call("POST", `/quotes/${v1.id}/revise`));
      for (const id of [v1.id, v2.id]) {
        const related = await json<QuoteRelated>(await call("GET", `/quotes/${id}/related`));
        expect(related.versions.map((v) => [v.version, v.status])).toEqual([
          [1, "sent"],
          [2, "draft"],
        ]);
        expect(related.lead).toBeNull();
        expect(related.invoices).toEqual([]);
      }
      expect((await call("GET", `/quotes/${v1.id}/related`, undefined, fieldCookie)).status).toBe(403);
      expect((await call("GET", `/quotes/${randomUUID()}/related`)).status).toBe(404);
    });
  });

  describe("US-QUO-35 · preview the PDF without saving", () => {
    it("renders the unsaved quote, new or a draft being edited, and writes nothing", async () => {
      const before = (await json<QuoteRow[]>(await call("GET", "/quotes"))).length;
      const res = await call("POST", "/quotes/preview-pdf", { contactId, currency: "USD", title: "Unsaved kitchen", lines: [{ type: "heading", name: "Cabinets" }, line] });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/pdf");
      const text = await pdfText(Buffer.from(await res.arrayBuffer()));
      expect(text).toContain("Unsaved kitchen");
      expect(text).toContain("Tiling");
      // Watermarked, so a preview can't pass for a quote.
      expect(text).toContain("Preview only — not a valid quote");
      expect((await json<QuoteRow[]>(await call("GET", "/quotes"))).length).toBe(before);

      const draft = await newQuote({ title: "Saved title" });
      const edited = await call("POST", "/quotes/preview-pdf", { contactId, currency: "USD", title: "Edited, not saved", lines: [line], quoteId: draft.id });
      expect(await pdfText(Buffer.from(await edited.arrayBuffer()))).toContain("Edited, not saved");
      expect((await json<QuoteRow>(await call("GET", `/quotes/${draft.id}`))).title).toBe("Saved title");
      const history = await json<unknown[]>(await call("GET", `/quotes/${draft.id}/history`));
      expect(history).toHaveLength(1);

      // A draft's own PDF is watermarked too; a sent quote's isn't.
      expect(await pdfText(Buffer.from(await (await call("GET", `/quotes/${draft.id}/pdf`)).arrayBuffer()))).toContain("not a valid quote");
      await sendQuote(draft.id);
      expect(await pdfText(Buffer.from(await (await call("GET", `/quotes/${draft.id}/pdf`)).arrayBuffer()))).not.toContain("not a valid quote");

      expect((await call("POST", "/quotes/preview-pdf", { contactId: randomUUID(), currency: "USD", lines: [line] })).status).toBe(400);
      expect((await call("POST", "/quotes/preview-pdf", { contactId, currency: "USD", lines: [line] }, fieldCookie)).status).toBe(403);
    });
  });

  describe("US-QUO-36 · start a quote valid for my usual number of days", () => {
    it("saves the quote validity in Settings › Documents, and a duplicate of a quote with no validity uses it", async () => {
      const bad = await call("PUT", "/org/settings/document_layout", { value: { quote: { validDays: 0 } } });
      expect(bad.status).toBe(400);
      expect((await call("PUT", "/org/settings/document_layout", { value: { quote: { validDays: 45 } } })).status).toBeLessThan(300);
      const original = await newQuote();
      expect(original.validUntil).toBeNull();
      const copy = await json<QuoteRow>(await call("POST", `/quotes/${original.id}/duplicate`));
      const days = Math.round((new Date(copy.validUntil!).getTime() - Date.now()) / (24 * 3600 * 1000));
      expect(days).toBeGreaterThanOrEqual(44);
      expect(days).toBeLessThanOrEqual(45);
    });
  });
});
