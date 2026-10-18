import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Attachment, AttachmentList } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { attachments, auditLog, contacts, expenseCategories, expenses, files, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user, vendorBills } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { MINIMAL_PDF } from "../files/test-photos";

type Who = { cookie: string; userId: string };

/**
 * US-OPS-35 — removing an attachment: editors on an editable record, only
 * Owners with a reason on a locked one; audited; the stored file goes once
 * nothing else uses it. Requires local Postgres.
 */
describe("US-OPS-35 · remove an attachment added by mistake (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let vendorId: string;
  let categoryId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  async function upload(who: Who, name = "docket.pdf") {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(MINIMAL_PDF)], { type: "application/pdf" }), name);
    return (await (await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() }, body: form })).json()) as { id: string };
  }
  async function attach(who: Who, entityType: string, entityId: string, fileId?: string, name = "docket.pdf") {
    const id = fileId ?? (await upload(who, name)).id;
    const res = await call(who, "POST", "/attachments", { entityType, entityId, fileId: id });
    expect(res.status, await res.clone().text()).toBe(201);
    return (await res.json()) as Attachment;
  }
  const bill = async (status: "draft" | "recorded", createdBy: string) =>
    (await db.insert(vendorBills).values({ orgId, contactId: vendorId, status, billNumber: `B-${randomUUID().slice(0, 6)}`, date: new Date(), currency: "USD", createdByUserId: createdBy }).returning())[0]!.id;
  const message = async (res: Response) => ((await res.json()) as { message: string }).message;

  async function newUser(name: string): Promise<Who> {
    const email = `us-ops-35-${name}-${randomUUID()}@example.com`;
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
    Object.assign(staff, await newUser("staff"));
    await join(staff, "staff", ["vendor_bills.edit_own", "vendor_bills.edit_others"]);
    Object.assign(field, await newUser("field"));
    await join(field, "field");
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    vendorId = vendor!.id;
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel" }).returning();
    categoryId = category!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("on a draft, an editor removes it without a reason; the stored file is deleted", async () => {
    const draft = await bill("draft", staff.userId);
    const added = await attach(staff, "vendor_bill", draft);
    const listed = (await (await call(staff, "GET", `/attachments?entityType=vendor_bill&entityId=${draft}`)).json()) as AttachmentList;
    expect(listed).toMatchObject({ canRemove: true, canRemoveWithReason: false });

    expect((await call(staff, "DELETE", `/attachments/${added.id}`)).status).toBe(200);
    expect(((await (await call(staff, "GET", `/attachments?entityType=vendor_bill&entityId=${draft}`)).json()) as AttachmentList).attachments).toEqual([]);
    expect(await db.select().from(files).where(eq(files.id, added.file.id))).toEqual([]);
    expect((await call(owner, "GET", `/files/${added.file.id}`)).status).toBe(404);
    const [row] = await db.select().from(attachments).where(eq(attachments.id, added.id));
    expect(row).toMatchObject({ removedByUserId: staff.userId, fileId: null });
    const history = await db.select().from(auditLog).where(and(eq(auditLog.entityType, "vendor_bill"), eq(auditLog.entityId, draft), eq(auditLog.action, "attachment_removed")));
    expect(history).toHaveLength(1);
  });

  it("on a recorded bill, Staff can't remove; an Owner can, with a reason, and history keeps it", async () => {
    const recorded = await bill("recorded", owner.userId);
    const added = await attach(owner, "vendor_bill", recorded, undefined, "delivery-docket-site.pdf");
    const asStaff = (await (await call(staff, "GET", `/attachments?entityType=vendor_bill&entityId=${recorded}`)).json()) as AttachmentList;
    expect(asStaff).toMatchObject({ canRemove: false, canRemoveWithReason: false, locked: true });
    expect((await call(staff, "DELETE", `/attachments/${added.id}`, { reason: "Mine" })).status).toBe(403);

    const noReason = await call(owner, "DELETE", `/attachments/${added.id}`, {});
    expect(noReason.status).toBe(400);
    expect(await message(noReason)).toBe("Give a reason for removing this file. The record's history keeps it.");
    expect((await call(owner, "DELETE", `/attachments/${added.id}`, { reason: "Wrong docket — belongs to bill 88240" })).status).toBe(200);

    const [entry] = await db.select().from(auditLog).where(and(eq(auditLog.entityId, recorded), eq(auditLog.action, "attachment_removed")));
    expect(entry!.changes).toEqual([
      { field: "attachment", from: "delivery-docket-site.pdf", to: null },
      { field: "reason", from: null, to: "Wrong docket — belongs to bill 88240" },
    ]);
    const [row] = await db.select().from(attachments).where(eq(attachments.id, added.id));
    expect(row!.removalReason).toBe("Wrong docket — belongs to bill 88240");
    expect((await call(owner, "DELETE", `/attachments/${added.id}`, { reason: "again" })).status).toBe(404);
  });

  it("a file something else still uses stays in storage", async () => {
    const draft = await bill("draft", owner.userId);
    const file = await upload(owner, "receipt.pdf");
    // The same upload is also an expense's receipt.
    await db.insert(expenses).values({ orgId, categoryId, date: new Date(), currency: "USD", amount: 100n, submittedByUserId: owner.userId, receiptFileId: file.id });
    // Linked directly: the API no longer lets one file serve two records (D-250), but older data can.
    const [added] = await db.insert(attachments).values({ orgId, entityType: "vendor_bill", entityId: draft, fileId: file.id, createdByUserId: owner.userId }).returning();
    expect((await call(owner, "DELETE", `/attachments/${added!.id}`)).status).toBe(200);
    expect(await db.select().from(files).where(eq(files.id, file.id))).toHaveLength(1);
    expect((await call(owner, "GET", `/files/${file.id}`)).status).toBe(200);
  });

  it("Field remove from their own submitted expense, not once it's approved", async () => {
    const [submitted] = await db.insert(expenses).values({ orgId, categoryId, date: new Date(), currency: "USD", amount: 100n, submittedByUserId: field.userId }).returning();
    const mine = await attach(field, "expense", submitted!.id);
    expect((await call(field, "DELETE", `/attachments/${mine.id}`)).status).toBe(200);

    const [approved] = await db.insert(expenses).values({ orgId, categoryId, date: new Date(), currency: "USD", amount: 100n, submittedByUserId: field.userId, status: "approved" }).returning();
    const locked = await attach(field, "expense", approved!.id);
    expect((await call(field, "DELETE", `/attachments/${locked.id}`, { reason: "oops" })).status).toBe(403);
  });
});
