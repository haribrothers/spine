import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { InvoiceActivityEntry } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { invoices, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { pdfText } from "../../test-utils/pdf-text";
import { QueueService } from "../queue/queue.service";

interface InvoiceRow {
  id: string;
  number: string | null;
  status: string;
  type: string;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  lineNames?: string[];
  lastPaidAt?: string | null;
  sourceQuoteNumber?: string | null;
  lines?: { name: string }[];
}

/**
 * US-INV-28 to US-INV-35 (D-217) — the API side of invoices you can work
 * from: list fields for search and "Paid <date>", a due date at issue from
 * the payment terms, the Activity, duplicate and the unsaved preview.
 * Requires local Postgres.
 */
describe("Invoices you can work from (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-inv-27-${randomUUID()}@example.com`;
  let cookie: string;
  let contactId: string;

  const call = (method: string, route: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => (await res.json()) as T;
  const line = { type: "item", name: "Waterproofing membrane", quantity: 2, unitPriceAmount: "50000" };
  const draft = async (extra: Record<string, unknown> = {}) => json<InvoiceRow>(await call("POST", "/invoices", { contactId, currency: "USD", lines: [line], ...extra }));
  const issue = async (id: string) => json<InvoiceRow>(await call("POST", `/invoices/${id}/issue`, {}));

  beforeAll(async () => {
    testApp = await createTestApp();
    vi.spyOn(testApp.app.get(QueueService), "send").mockResolvedValue(null);
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Priya Raman" });
    cookie = owner.cookie;
    void (await db.select().from(member).where(eq(member.userId, owner.userId)));
    contactId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Sahyadri Retail Pvt Ltd", email: "accounts@sahyadri.example" }))).id;
  }, 120_000);

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email]));
  });

  describe("US-INV-33 · give every invoice a due date from my payment terms", () => {
    it("an invoice issued without a due date is due 30 days after its issue date", async () => {
      const inv = await draft({ issueDate: "2026-09-04" });
      const issued = await issue(inv.id);
      expect(issued.dueDate?.slice(0, 10)).toBe("2026-10-04");
    });

    it("follows Settings › Documents › Invoices due in (0 is on receipt), and keeps a due date given", async () => {
      expect((await call("PUT", "/org/settings/document_layout", { value: { invoice: { dueDays: 0 } } })).status).toBeLessThan(300);
      const onReceipt = await issue((await draft({ issueDate: "2026-09-04" })).id);
      expect(onReceipt.dueDate?.slice(0, 10)).toBe("2026-09-04");
      const given = await issue((await draft({ issueDate: "2026-09-04", dueDate: "2026-12-01" })).id);
      expect(given.dueDate?.slice(0, 10)).toBe("2026-12-01");
      expect((await call("PUT", "/org/settings/document_layout", { value: { invoice: { dueDays: 400 } } })).status).toBe(400);
      expect((await call("PUT", "/org/settings/document_layout", { value: {} })).status).toBeLessThan(300);
    });
  });

  describe("US-INV-28, US-INV-29 · what the list reads", () => {
    it("rows carry their line names and the date they were last paid", async () => {
      const inv = await issue((await draft({ issueDate: "2026-09-10" })).id);
      const pay = await call("POST", "/payments", { contactId, date: "2026-10-02", method: "bank_transfer", currency: "USD", amount: "40000", allocations: [{ invoiceId: inv.id, amount: "40000" }] });
      expect(pay.status).toBeLessThan(300);
      const row = (await json<InvoiceRow[]>(await call("GET", "/invoices"))).find((i) => i.id === inv.id)!;
      expect(row.lineNames).toEqual(["Waterproofing membrane"]);
      expect(row.lastPaidAt).toBe("2026-10-02");
    });

    it("the invoice's page reads its tax by name (US-INV-31) and its last payment's date", async () => {
      const inv = await issue((await draft({ issueDate: "2026-09-10", lines: [{ ...line, taxRatePercentage: 10 }] })).id);
      await call("POST", "/payments", { contactId, date: "2026-10-03", method: "upi", currency: "USD", amount: "5000", allocations: [{ invoiceId: inv.id, amount: "5000" }] });
      const detail = await json<InvoiceRow & { taxLines: { label: string; amount: string }[] }>(await call("GET", `/invoices/${inv.id}`));
      expect(detail.taxLines.map((t) => t.amount)).toEqual(["10000"]);
      expect(detail.lastPaidAt).toBe("2026-10-03");
    });
  });

  describe("US-INV-32 · follow what happened to an invoice", () => {
    it("lists created, issued, emailed, reminded, paid and voided, newest first, with who", async () => {
      const inv = await issue((await draft({ issueDate: "2026-08-01" })).id);
      expect((await call("POST", `/invoices/${inv.id}/send-email`, {})).status).toBeLessThan(300);
      await db.update(invoices).set({ emailStatus: "sent" }).where(eq(invoices.id, inv.id));
      expect((await call("POST", `/invoices/${inv.id}/send-reminder`, {})).status).toBeLessThan(300);
      await call("POST", "/payments", { contactId, date: "2026-10-01", method: "cash", currency: "USD", amount: "10000", allocations: [{ invoiceId: inv.id, amount: "10000" }] });
      const entries = await json<InvoiceActivityEntry[]>(await call("GET", `/invoices/${inv.id}/activity`));
      expect(entries.map((e) => e.type)).toEqual(expect.arrayContaining(["created", "issued", "emailed", "reminder_sent", "payment_recorded"]));
      expect(entries.find((e) => e.type === "emailed")?.detail).toBe("accounts@sahyadri.example");
      expect(entries.find((e) => e.type === "payment_recorded")).toMatchObject({ amount: "10000", method: "cash", actorName: "Priya Raman" });
      expect([...entries].sort((a, b) => b.at.localeCompare(a.at))).toEqual(entries);

      const other = await issue((await draft()).id);
      expect((await call("POST", `/invoices/${other.id}/void`, { reason: "Raised twice." })).status).toBeLessThan(300);
      const voided = await json<InvoiceActivityEntry[]>(await call("GET", `/invoices/${other.id}/activity`));
      expect(voided[0]).toMatchObject({ type: "voided", detail: "Raised twice." });
    });
  });

  describe("US-INV-35 · duplicate an invoice", () => {
    it("makes a new draft with the same customer, lines and notes, no number or dates, and says where it came from", async () => {
      const source = await issue((await draft({ notes: "Thanks for your business.", issueDate: "2026-09-01" })).id);
      const res = await call("POST", `/invoices/${source.id}/duplicate`);
      expect(res.status).toBe(201);
      const copy = await json<InvoiceRow>(res);
      expect(copy).toMatchObject({ status: "draft", number: null, type: "standard", issueDate: null, dueDate: null, notes: "Thanks for your business." });
      expect(copy.lines?.map((l) => l.name)).toEqual(["Waterproofing membrane"]);
      const [made] = await json<InvoiceActivityEntry[]>(await call("GET", `/invoices/${copy.id}/activity`));
      expect(made).toMatchObject({ type: "duplicated", detail: source.number, linkId: source.id });
    });
  });

  describe("US-INV-34 · preview the invoice as it is on screen", () => {
    it("renders the unsaved invoice, watermarked, and writes nothing", async () => {
      const before = (await json<InvoiceRow[]>(await call("GET", "/invoices"))).length;
      const res = await call("POST", "/invoices/preview-pdf", { contactId, currency: "USD", lines: [{ ...line, name: "Unsaved canopy work" }] });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/pdf");
      const text = await pdfText(Buffer.from(await res.arrayBuffer()));
      expect(text).toContain("Unsaved canopy work");
      expect(text).toContain("Preview only");
      expect((await json<InvoiceRow[]>(await call("GET", "/invoices"))).length).toBe(before);

      // A saved draft's PDF is watermarked too; an issued one isn't.
      const saved = await draft();
      expect(await pdfText(Buffer.from(await (await call("GET", `/invoices/${saved.id}/pdf`)).arrayBuffer()))).toContain("Preview only");
    });
  });
});
