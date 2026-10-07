import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AttachmentEntityType, MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, creditNotes, expenseCategories, expenses, invoices, member, payments, quotes, session as sessionTable, teamMemberships, teamPrivileges, teams, user, vendorBills, vendorPayments } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { DataExportService } from "../data-export/data-export.service";
import { MINIMAL_PDF } from "../files/test-photos";

type Who = { cookie: string; userId: string };

/**
 * US-OPS-34 (D-156, D-117) — `GET /files/:id` serves an attachment only to
 * someone who can open its record, tested per record type; Field only on
 * their own expenses; exports put attachments under attachments/. Requires
 * local Postgres.
 */
describe("US-OPS-34 · open attachments only when I can open the record (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const fileOf = new Map<string, string>();
  const recordOf = new Map<string, string>();
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const bookkeeper: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const outsider: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const read = (who: Who, fileId: string, query = "") => fetch(`${testApp.baseUrl}/files/${fileId}${query}`, { headers: { cookie: who.cookie } });

  async function attach(who: Who, entityType: AttachmentEntityType, entityId: string, key: string = entityType) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(MINIMAL_PDF)], { type: "application/pdf" }), `${key}.pdf`);
    const file = (await (await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() }, body: form })).json()) as { id: string };
    const res = await call(who, "POST", "/attachments", { entityType, entityId, fileId: file.id });
    expect(res.status, await res.clone().text()).toBe(201);
    fileOf.set(key, file.id);
    recordOf.set(key, entityId);
  }

  async function newUser(name: string): Promise<Who> {
    const email = `us-ops-34-${name}-${randomUUID()}@example.com`;
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
    await join(staff, "staff");
    Object.assign(bookkeeper, await newUser("bookkeeper"));
    await join(bookkeeper, "staff", ["banking.view"]);
    Object.assign(field, await newUser("field"));
    await join(field, "field");
    Object.assign(outsider, await newUser("outsider"));

    const by = owner.userId;
    const [customer] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: by }).returning();
    const contactId = customer!.id;
    const [quote] = await db.insert(quotes).values({ orgId, contactId, currency: "USD", createdByUserId: by }).returning();
    const [invoice] = await db.insert(invoices).values({ orgId, contactId, currency: "USD", createdByUserId: by }).returning();
    const [credit] = await db.insert(creditNotes).values({ orgId, contactId, invoiceId: invoice!.id, currency: "USD", createdByUserId: by }).returning();
    const [payment] = await db.insert(payments).values({ orgId, contactId, date: new Date(), method: "cash", currency: "USD", amount: 100n, createdByUserId: by }).returning();
    const [bill] = await db.insert(vendorBills).values({ orgId, contactId, billNumber: "88213", date: new Date(), currency: "USD", createdByUserId: by }).returning();
    const [vendorPayment] = await db.insert(vendorPayments).values({ orgId, contactId, date: new Date(), method: "cash", currency: "USD", amount: 100n, createdByUserId: by }).returning();
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel" }).returning();
    const [ownersExpense] = await db.insert(expenses).values({ orgId, categoryId: category!.id, date: new Date(), currency: "USD", amount: 100n, submittedByUserId: by }).returning();
    const [fieldExpense] = await db.insert(expenses).values({ orgId, categoryId: category!.id, date: new Date(), currency: "USD", amount: 100n, submittedByUserId: field.userId }).returning();
    const bank = ((await (await call(owner, "GET", "/money-accounts")).json()) as MoneyAccount[]).find((a) => a.code === "1010")!;
    const capital = (await db.select().from(accounts).where(eq(accounts.orgId, orgId))).find((a) => a.code === "3000")!;
    const entry = (await (await call(owner, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "in", accountId: capital.id, amount: "100", date: "2026-09-30" })).json()) as { id: string };

    await attach(owner, "quote", quote!.id);
    await attach(owner, "invoice", invoice!.id);
    await attach(owner, "credit_note", credit!.id);
    await attach(owner, "payment", payment!.id);
    await attach(owner, "vendor_bill", bill!.id);
    await attach(owner, "vendor_payment", vendorPayment!.id);
    await attach(owner, "expense", ownersExpense!.id);
    await attach(owner, "bank_transaction", entry.id);
    await attach(owner, "contact", contactId);
    await attach(field, "expense", fieldExpense!.id, "field_expense");
  }, 180_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  const ALL = ["quote", "invoice", "credit_note", "payment", "vendor_bill", "vendor_payment", "expense", "bank_transaction", "contact", "field_expense"];

  it("Owners open every attachment, previewed in the browser or downloaded", async () => {
    for (const key of ALL) expect((await read(owner, fileOf.get(key)!)).status, key).toBe(200);
    const inline = await read(owner, fileOf.get("vendor_bill")!);
    expect(inline.headers.get("content-disposition")).toMatch(/^inline; filename="vendor_bill.pdf"/);
    expect(inline.headers.get("content-type")).toBe("application/pdf");
    const download = await read(owner, fileOf.get("vendor_bill")!, "?download=1");
    expect(download.headers.get("content-disposition")).toMatch(/^attachment; filename="vendor_bill.pdf"/);
  });

  it("Staff open the records they can open: everything but a bank entry without banking.view", async () => {
    for (const key of ALL) expect((await read(staff, fileOf.get(key)!)).status, key).toBe(key === "bank_transaction" ? 404 : 200);
    expect((await read(bookkeeper, fileOf.get("bank_transaction")!)).status).toBe(200);
  });

  it("Field open attachments only on their own expenses, never money documents", async () => {
    for (const key of ALL) expect((await read(field, fileOf.get(key)!)).status, key).toBe(key === "field_expense" ? 200 : 404);
    const listed = await call(field, "GET", `/attachments?entityType=expense&entityId=${recordOf.get("field_expense")}`);
    expect(listed.status).toBe(200);
    expect((await call(field, "GET", `/attachments?entityType=invoice&entityId=${recordOf.get("invoice")}`)).status).toBe(404);
  });

  it("someone from another organisation gets a 404 for every file", async () => {
    for (const key of ALL) expect((await read(outsider, fileOf.get(key)!)).status, key).toBe(404);
  });

  it("a data export with files puts attachments under attachments/<entity>/<id>/", async () => {
    const stream = testApp.app.get(DataExportService).buildZip(orgId, ["csv"], true);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const zip = unzipSync(new Uint8Array(Buffer.concat(chunks)));
    const names = Object.keys(zip);
    for (const key of ALL.filter((k) => k !== "field_expense")) {
      expect(names, key).toContain(`attachments/${key}/${recordOf.get(key)}/${fileOf.get(key)}-${key}.pdf`);
    }
    expect(names).toContain(`attachments/expense/${recordOf.get("field_expense")}/${fileOf.get("field_expense")}-field_expense.pdf`);
    expect(names).toContain("attachments.csv");
    expect(names).toContain("money_accounts.csv");
    expect(names.some((n) => n.startsWith("files/") && n.includes(fileOf.get("vendor_bill")!))).toBe(false);
  });
});
