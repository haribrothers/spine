import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, member, session as sessionTable } from "../../db/schema";
import { pdfText } from "../../test-utils/pdf-text";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";
import { IssuedPdfService } from "./issued-pdf.service";

type Who = { cookie: string; userId: string };

/** A valid 2×1 black-and-white PNG. */
function tinyPng(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from([0, 0, 255]))), chunk("IEND", Buffer.alloc(0))]);
}

const hasImage = (pdf: Buffer) => /\/Subtype \/Image/.test(pdf.toString("latin1"));

/** US-SET-19 — a signature and the amount in words on documents. Requires local Postgres. */
describe("US-SET-19 · add a signature and the amount in words (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let signatureId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const pdfOf = async (path: string) => Buffer.from(await (await call(owner, "GET", path)).arrayBuffer());
  const draftInvoice = async () => {
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Lakeview Homes", createdByUserId: owner.userId }).returning();
    return testApp.app.get(InvoicesService).create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: contact!.id, currency: "INR", lines: [{ name: "Kitchen", quantity: 1, unitPriceAmount: "24190000" }] }));
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [staff, "staff"], [field, "field"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-set-19-${name}-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [field, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    await call(owner, "PUT", "/org/settings/business_profile", { value: { name: "Kaveri Interiors" } });
    await call(owner, "PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } });
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(tinyPng())], { type: "image/png" }), "signature.png");
    const res = await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: { cookie: owner.cookie, "Idempotency-Key": randomUUID() }, body: form });
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    signatureId = ((await res.json()) as { id: string }).id;
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("prints the signature above 'Authorised signatory — <business>' on the document types that show it", async () => {
    await call(owner, "PUT", "/org/settings/document_layout", { value: { signatureFileId: signatureId, invoice: { signature: true } } });
    const draft = await draftInvoice();
    const invoicePdf = await pdfOf(`/invoices/${draft.id}/pdf`);
    expect(pdfText(invoicePdf)).toContain("Authorised signatory — Kaveri Interiors");
    expect(hasImage(invoicePdf)).toBe(true);
    // Quotes don't tick it, so they don't show it.
    const quote = (await (await call(owner, "POST", "/quotes", { contactId: draft.contactId, currency: "INR", lines: [{ name: "Kitchen", quantity: 1, unitPriceAmount: "1000" }] })).json()) as { id: string };
    expect(pdfText(await pdfOf(`/quotes/${quote.id}/pdf`))).not.toContain("Authorised signatory");
  });

  it("prints the total in words when 'Amount in words' is on (lakh and crore for rupees)", async () => {
    await call(owner, "PUT", "/org/settings/document_layout", { value: { signatureFileId: signatureId, invoice: { signature: true, amountInWords: true } } });
    const draft = await draftInvoice();
    expect(pdfText(await pdfOf(`/invoices/${draft.id}/pdf`))).toContain("Rupees Two Lakh Forty-One Thousand Nine Hundred Only");
  });

  it("removing the signature leaves new PDFs without it; an issued one keeps its own", async () => {
    const issuedDraft = await draftInvoice();
    await testApp.app.get(InvoicesService).issue(orgId, issuedDraft.id, owner.userId);
    // The PDF is stored when it's issued (the queue does it moments later; here, now).
    await testApp.app.get(IssuedPdfService).getOrStore(orgId, "invoice", issuedDraft.id);
    await call(owner, "PUT", "/org/settings/document_layout", { value: { signatureFileId: null, invoice: { signature: true, amountInWords: true } } });
    const draft = await draftInvoice();
    expect(pdfText(await pdfOf(`/invoices/${draft.id}/pdf`))).not.toContain("Authorised signatory");
    expect(pdfText(await pdfOf(`/invoices/${issuedDraft.id}/pdf`))).toContain("Authorised signatory — Kaveri Interiors");
  });

  it("Staff can open the signature image; Field can't", async () => {
    await call(owner, "PUT", "/org/settings/document_layout", { value: { signatureFileId: signatureId } });
    expect((await call(staff, "GET", `/files/${signatureId}`)).status).toBe(200);
    expect((await call(field, "GET", `/files/${signatureId}`)).status).toBe(404);
  });
});
