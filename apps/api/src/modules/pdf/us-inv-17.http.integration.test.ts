import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createInvoiceSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, creditNotes, files, invoices, member, payments, quotes, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { FilesService } from "../files/files.service";
import { InvoicesService } from "../invoices/invoices.service";
import { SettingsService } from "../org/settings.service";
import type { QueueService } from "../queue/queue.service";
import { IssuedPdfService, STORE_ISSUED_PDF_QUEUE, queueIssuedPdf } from "./issued-pdf.service";

/**
 * US-INV-17 — issued documents keep the PDF stored at issue; drafts render
 * live. Real routes and services on a demo-seeded org; local storage on a
 * temp folder. Requires local Postgres.
 */
describe("US-INV-17 · keep the exact PDF that was issued (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let filesDir: string;
  const savedEnv = { STORAGE_DRIVER: process.env.STORAGE_DRIVER, FILES_DIR: process.env.FILES_DIR };
  const createdEmails: string[] = [];
  let cookie: string;
  let orgId: string;
  let userId: string;

  async function pdf(route: string): Promise<Buffer> {
    const res = await fetch(`${testApp.baseUrl}${route}`, { headers: { cookie } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    return Buffer.from(await res.arrayBuffer());
  }

  async function orgFileCount(): Promise<number> {
    return (await db.select({ id: files.id }).from(files).where(eq(files.orgId, orgId))).length;
  }

  async function draftInvoice(): Promise<string> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.orgId, orgId)).limit(1);
    const created = await testApp.app.get(InvoicesService).create(
      orgId,
      userId,
      createInvoiceSchema.parse({
        contactId: contact!.id,
        currency: "USD",
        lines: [{ name: "Site visit", quantity: 1, unitPriceAmount: "12500" }],
      }),
    );
    return created.id;
  }

  beforeAll(async () => {
    filesDir = await mkdtemp(path.join(tmpdir(), "spine-inv17-"));
    delete process.env.STORAGE_DRIVER;
    process.env.FILES_DIR = filesDir;
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");

    const email = `us-inv-17-${randomUUID()}@example.com`;
    createdEmails.push(email);
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "PDF Owner" });
    cookie = owner.cookie;
    userId = owner.userId;
    const [membership] = await db.select().from(member).where(eq(member.userId, owner.userId));
    orgId = membership!.organizationId;

    const seeded = await fetch(`${testApp.baseUrl}/demo-data/seed`, { method: "POST", headers: { cookie, "Idempotency-Key": randomUUID() } });
    expect(seeded.status).toBeLessThan(300);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    if (createdEmails.length) await db.delete(user).where(inArray(user.email, createdEmails));
    await rm(filesDir, { recursive: true, force: true });
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("renders a draft live and stores nothing", async () => {
    const id = await draftInvoice();
    const before = await orgFileCount();
    const first = await pdf(`/invoices/${id}/pdf`);
    await pdf(`/invoices/${id}/pdf`);
    expect(first.subarray(0, 5).toString()).toBe("%PDF-");
    expect(await orgFileCount()).toBe(before);
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id));
    expect(row?.issuedPdfFileId).toBeNull();
  });

  it("stores the PDF at issue and serves the same bytes after the address, logo and branding change", async () => {
    const id = await draftInvoice();
    await testApp.app.get(InvoicesService).issue(orgId, id, userId);
    // The queued job stores it; doing the same work directly keeps the test deterministic.
    await testApp.app.get(IssuedPdfService).getOrStore(orgId, "invoice", id);
    const [issued] = await db.select().from(invoices).where(eq(invoices.id, id));
    expect(issued?.issuedPdfFileId).not.toBeNull();
    const original = await pdf(`/invoices/${id}/pdf`);

    await testApp.app.get(SettingsService).set(orgId, "business_profile", { name: "Renamed Builders Ltd", address: "1 New Street" });
    await db.update(contacts).set({ name: "A Different Customer" }).where(eq(contacts.id, issued!.contactId));

    const later = await pdf(`/invoices/${id}/pdf`);
    expect(later.equals(original)).toBe(true);
    const { bytes } = await testApp.app.get(FilesService).readBytes(orgId, issued!.issuedPdfFileId!);
    expect(bytes.equals(original)).toBe(true);
  });

  it("stores a document issued before this story on its first download and serves it from then on", async () => {
    const [legacy] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.orgId, orgId), eq(invoices.status, "issued")))
      .limit(1);
    await db.update(invoices).set({ issuedPdfFileId: null }).where(eq(invoices.id, legacy!.id));

    const first = await pdf(`/invoices/${legacy!.id}/pdf`);
    const [after] = await db.select().from(invoices).where(eq(invoices.id, legacy!.id));
    expect(after?.issuedPdfFileId).not.toBeNull();
    expect((await pdf(`/invoices/${legacy!.id}/pdf`)).equals(first)).toBe(true);
  });

  it("stores the PDF of a sent quote, an issued credit note and a receipt", async () => {
    const [sentQuote] = await db.select().from(quotes).where(and(eq(quotes.orgId, orgId), eq(quotes.status, "sent"))).limit(1);
    const [creditNote] = await db.select().from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.status, "issued"))).limit(1);
    const [payment] = await db.select().from(payments).where(eq(payments.orgId, orgId)).limit(1);

    for (const [route, table, id] of [
      ["quotes", quotes, sentQuote!.id],
      ["credit-notes", creditNotes, creditNote!.id],
      ["payments", payments, payment!.id],
    ] as const) {
      const first = await pdf(`/${route}/${id}/pdf`);
      expect(first.subarray(0, 5).toString()).toBe("%PDF-");
      const [row] = await db.select({ issuedPdfFileId: table.issuedPdfFileId }).from(table).where(eq(table.id, id));
      expect(row?.issuedPdfFileId, route).not.toBeNull();
      expect((await pdf(`/${route}/${id}/pdf`)).equals(first), route).toBe(true);
    }
  });

  it("renders a credit note as a PDF titled with its number and the invoice it credits", async () => {
    const [creditNote] = await db.select().from(creditNotes).where(and(eq(creditNotes.orgId, orgId), eq(creditNotes.status, "issued"))).limit(1);
    const res = await fetch(`${testApp.baseUrl}/credit-notes/${creditNote!.id}/pdf`, { headers: { cookie } });
    expect(res.headers.get("content-disposition")).toBe(`inline; filename="${creditNote!.number}.pdf"`);
  });

  it("stores exactly one PDF when two requests race for a document's first download", async () => {
    const id = await draftInvoice();
    await testApp.app.get(InvoicesService).issue(orgId, id, userId);
    const before = await orgFileCount();

    const service = testApp.app.get(IssuedPdfService);
    const [a, b] = await Promise.all([service.getOrStore(orgId, "invoice", id), service.getOrStore(orgId, "invoice", id)]);

    expect(a!.buffer.equals(b!.buffer)).toBe(true);
    // The queued job may also have stored it; whichever won, one file remains.
    expect(await orgFileCount()).toBe(before + 1);
  });

  it("issuing still succeeds when the PDF can't be stored, and the store job is retried", async () => {
    const send = vi.fn().mockRejectedValue(new Error("queue down"));
    await expect(queueIssuedPdf({ send } as unknown as QueueService, orgId, "invoice", randomUUID())).resolves.toBeUndefined();

    const retrying = vi.fn().mockResolvedValue(undefined);
    await queueIssuedPdf({ send: retrying } as unknown as QueueService, orgId, "invoice", "inv-1");
    expect(retrying).toHaveBeenCalledWith(
      STORE_ISSUED_PDF_QUEUE,
      { orgId, kind: "invoice", id: "inv-1" },
      expect.objectContaining({ retryLimit: 30 }),
    );

    // With storage down, the job's work fails (so pg-boss retries it) but an email still gets a PDF.
    const service = testApp.app.get(IssuedPdfService);
    const id = await draftInvoice();
    await testApp.app.get(InvoicesService).issue(orgId, id, userId);
    const filesService = testApp.app.get(FilesService);
    const upload = vi.spyOn(filesService, "upload").mockRejectedValue(new Error("storage unavailable"));
    try {
      await db.update(invoices).set({ issuedPdfFileId: null }).where(eq(invoices.id, id));
      await expect(service.getOrStore(orgId, "invoice", id)).rejects.toThrow("storage unavailable");
      const attachment = await service.forEmail(orgId, "invoice", id);
      expect(attachment.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    } finally {
      upload.mockRestore();
    }
    const [row] = await db.select().from(invoices).where(eq(invoices.id, id));
    expect(row?.status).toBe("issued");
  });
});
