import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema, type DocumentLayout } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, member, session as sessionTable } from "../../db/schema";
import { pdfText } from "../../test-utils/pdf-text";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";

type Who = { cookie: string; userId: string };

/** The first page's width and height in points. */
function pageSize(buf: Buffer): [number, number] {
  const m = buf.toString("latin1").match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  return [Math.round(Number(m![1])), Math.round(Number(m![2]))];
}

/** US-SET-17 — paper size and columns per document type, with a live preview. Requires local Postgres. */
describe("US-SET-17 · choose paper size and columns for each document (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const preview = async (type: string, layout: DocumentLayout, who: Who = owner) => {
    const res = await call(who, "GET", `/org/settings/document_layout/preview?type=${type}&layout=${Buffer.from(JSON.stringify(layout)).toString("base64url")}`);
    return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get("content-type") };
  };
  const save = (layout: unknown) => call(owner, "PUT", "/org/settings/document_layout", { value: layout });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await signUp(testApp.baseUrl, { email: `us-set-17-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" }));
    Object.assign(staff, await signUp(testApp.baseUrl, { email: `us-set-17-s-${randomUUID()}@example.com`, password: "testpassword123", name: "Staff" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, staff.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it("previews every document type as a PDF with sample data, A4 by default", async () => {
    for (const type of ["quote", "invoice", "credit_note", "receipt", "statement"]) {
      const res = await preview(type, {});
      expect(res.status, type).toBe(200);
      expect(res.type).toBe("application/pdf");
      expect(pageSize(res.buf), type).toEqual([595, 842]);
      if (process.env.SPINE_PREVIEW_DIR) writeFileSync(`${process.env.SPINE_PREVIEW_DIR}/${type}.pdf`, res.buf);
    }
  });

  it("the preview follows unsaved options: Letter paper and hidden columns", async () => {
    const full = pdfText((await preview("invoice", {})).buf);
    for (const heading of ["QTY", "UNIT PRICE", "DISC.", "TAX", "AMOUNT"]) expect(full.toUpperCase()).toContain(heading);
    const trimmed = await preview("invoice", { invoice: { paperSize: "LETTER", columns: { quantity: false, discount: false, lineTax: false } } });
    expect(pageSize(trimmed.buf)).toEqual([612, 792]);
    const text = pdfText(trimmed.buf);
    expect(text).not.toMatch(/Qty|Unit price|Disc\./);
    // Hidden columns don't change any amounts: the line total stays.
    expect(text).toContain("26,550.00");
  });

  it("with Discount hidden, a discounted line prints its discounted price", async () => {
    const withDiscount = pdfText((await preview("invoice", {})).buf);
    expect(withDiscount).toContain("12,500.00");
    expect(withDiscount).toContain("10%");
    const without = pdfText((await preview("invoice", { invoice: { columns: { discount: false } } })).buf);
    expect(without).toContain("11,250.00");
    expect(without).not.toContain("10%");
  });

  it("saves the options; an issued invoice's PDF uses them and never changes afterwards", async () => {
    expect((await save({ invoice: { paperSize: "LETTER", columns: { quantity: false } } })).status).toBeLessThan(300);
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Alan Brooks", createdByUserId: owner.userId }).returning();
    const invoices = testApp.app.get(InvoicesService);
    const draft = await invoices.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: contact!.id, currency: "USD", lines: [{ name: "Survey", quantity: 3, unitPriceAmount: "10000" }] }));
    await invoices.issue(orgId, draft.id, owner.userId);
    const issued = async () => Buffer.from(await (await call(owner, "GET", `/invoices/${draft.id}/pdf`)).arrayBuffer());
    const first = await issued();
    expect(pageSize(first)).toEqual([612, 792]);
    expect(pdfText(first)).not.toContain("Qty");

    await save({ invoice: { paperSize: "A4" } });
    expect(pageSize(await issued())).toEqual([612, 792]);
  });

  it("refuses unknown options, and only the Owner can save or preview", async () => {
    expect((await save({ invoice: { paperSize: "A3" } })).status).toBe(400);
    expect((await save({ invoice: { colour: "red" } })).status).toBe(400);
    expect((await call(staff, "PUT", "/org/settings/document_layout", { value: {} })).status).toBe(403);
    expect((await preview("invoice", {}, staff)).status).toBe(403);
    expect((await preview("letterhead", {})).status).toBe(400);
  });
});
