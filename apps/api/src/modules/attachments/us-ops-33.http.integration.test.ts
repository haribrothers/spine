import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Attachment, AttachmentList } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { auditLog, contacts, expenseCategories, expenses, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user, vendorBills } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { MINIMAL_PDF, jpegWithGps } from "../files/test-photos";

type Who = { cookie: string; userId: string };

/**
 * US-OPS-33 (D-156) — files kept with a record: added by whoever can edit
 * it, listed with who added them, at most 10 a record, and counted on the
 * bill and expense lists. Requires local Postgres.
 */
describe("US-OPS-33 · attach files to bills, invoices and other records (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let billId: string;
  let contactId: string;
  let categoryId: string;
  const owner: Who = { cookie: "", userId: "" };
  const readOnly: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  async function upload(who: Who, name: string, bytes: Uint8Array, type: string): Promise<Response> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type }), name);
    return fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() }, body: form });
  }
  async function attach(who: Who, entityType: string, entityId: string, name = "coastal-timber-88213.pdf", bytes: Uint8Array = MINIMAL_PDF, type = "application/pdf") {
    const file = (await (await upload(who, name, bytes, type)).json()) as { id: string };
    return call(who, "POST", "/attachments", { entityType, entityId, fileId: file.id });
  }
  const list = async (who: Who, entityType: string, entityId: string) => call(who, "GET", `/attachments?entityType=${entityType}&entityId=${entityId}`);

  async function newUser(name: string): Promise<Who> {
    const email = `us-ops-33-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function join(who: Who, role: "staff" | "field", grants: string[] = []) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role !== "staff") return;
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(readOnly, await newUser("readonly"));
    await join(readOnly, "staff", []);
    Object.assign(field, await newUser("field"));
    await join(field, "field");

    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    contactId = vendor!.id;
    const [bill] = await db.insert(vendorBills).values({ orgId, contactId, status: "recorded", billNumber: "88213", date: new Date(), currency: "USD", totalAmount: 216000n, createdByUserId: owner.userId }).returning();
    billId = bill!.id;
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel & freight" }).returning();
    categoryId = category!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("adds a file to a bill and lists it with its name, size, who added it and when", async () => {
    const res = await attach(owner, "vendor_bill", billId);
    expect(res.status).toBe(201);
    const added = (await res.json()) as Attachment;
    expect(added).toMatchObject({ file: { name: "coastal-timber-88213.pdf", size: MINIMAL_PDF.length, contentType: "application/pdf" }, createdBy: { id: owner.userId, name: "owner" } });

    const photo = await attach(owner, "vendor_bill", billId, "delivery-docket-site.jpg", jpegWithGps(), "image/jpeg");
    expect(photo.status).toBe(201);

    const listed = (await (await list(owner, "vendor_bill", billId)).json()) as AttachmentList;
    expect(listed.attachments.map((a) => [a.file.name, a.file.contentType])).toEqual([
      ["coastal-timber-88213.pdf", "application/pdf"],
      ["delivery-docket-site.jpg", "image/jpeg"],
    ]);
    expect(listed).toMatchObject({ canAdd: true, locked: true, canRemove: false, canRemoveWithReason: true });

    const history = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "vendor_bill"), eq(auditLog.entityId, billId)));
    expect(history.map((h) => h.action)).toEqual(["attachment_added", "attachment_added"]);
  });

  it("an 11th file is refused", async () => {
    const [contact] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    for (let i = 0; i < 10; i++) expect((await attach(owner, "contact", contact!.id, `contract-${i}.pdf`)).status).toBe(201);
    const eleventh = await attach(owner, "contact", contact!.id, "contract-10.pdf");
    expect(eleventh.status).toBe(400);
    expect(((await eleventh.json()) as { message: string }).message).toBe("A record can hold up to 10 files. Remove one first.");
  });

  it("refuses other file types and files over 10 MB with the upload messages", async () => {
    const text = await upload(owner, "notes.txt", Buffer.from("hello"), "text/plain");
    expect(text.status).toBe(415);
    expect(((await text.json()) as { message: string }).message).toBe("This file type isn't supported. Upload a photo or a PDF.");
    const big = await upload(owner, "scan.pdf", Buffer.concat([MINIMAL_PDF, Buffer.alloc(10 * 1024 * 1024)]), "application/pdf");
    expect(big.status).toBe(413);
    expect(((await big.json()) as { message: string }).message).toBe("This file is over 10 MB. Upload a smaller copy, or split the PDF.");
  });

  it("only a file you uploaded, attached once", async () => {
    const file = (await (await upload(owner, "slip.pdf", MINIMAL_PDF, "application/pdf")).json()) as { id: string };
    const [other] = await db.insert(vendorBills).values({ orgId, contactId, status: "draft", billNumber: "B-2", date: new Date(), currency: "USD", createdByUserId: owner.userId }).returning();
    expect((await call(owner, "POST", "/attachments", { entityType: "vendor_bill", entityId: other!.id, fileId: file.id })).status).toBe(201);
    const again = await call(owner, "POST", "/attachments", { entityType: "vendor_bill", entityId: billId, fileId: file.id });
    expect(again.status).toBe(400);

    const fieldFile = (await (await upload(field, "mine.pdf", MINIMAL_PDF, "application/pdf")).json()) as { id: string };
    expect((await call(owner, "POST", "/attachments", { entityType: "vendor_bill", entityId: billId, fileId: fieldFile.id })).status).toBe(400);
  });

  it("adding needs the record's edit right; reading needs its read right", async () => {
    // Staff with no bill rights can read the bill's files but not add one.
    expect((await list(readOnly, "vendor_bill", billId)).status).toBe(200);
    expect(((await (await list(readOnly, "vendor_bill", billId)).json()) as AttachmentList).canAdd).toBe(false);
    expect((await attach(readOnly, "vendor_bill", billId)).status).toBe(403);
    // Field never reach a bill, but add to their own expense.
    expect((await list(field, "vendor_bill", billId)).status).toBe(404);
    const [own] = await db.insert(expenses).values({ orgId, categoryId, date: new Date(), currency: "USD", amount: 6400n, submittedByUserId: field.userId }).returning();
    expect((await attach(field, "expense", own!.id, "receipt-extra.jpg", jpegWithGps(), "image/jpeg")).status).toBe(201);
    // A record type that can't hold files yet, or a missing record: 404.
    expect((await list(owner, "vendor_credit", randomUUID())).status).toBe(404);
    expect((await list(owner, "invoice", randomUUID())).status).toBe(404);
  });

  it("bill and expense lists carry the count for the paperclip", async () => {
    const bills = (await (await call(owner, "GET", "/vendor-bills")).json()) as { id: string; attachmentCount: number }[];
    expect(bills.find((b) => b.id === billId)?.attachmentCount).toBe(2);
    const rows = (await (await call(field, "GET", "/expenses")).json()) as { attachmentCount: number }[];
    expect(rows[0]?.attachmentCount).toBe(1);
  });
});
