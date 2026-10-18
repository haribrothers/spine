import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RECEIPT_IN_USE, RECEIPT_UPLOAD_FIRST } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, expenseCategories, member, session as sessionTable } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { billPhoto } from "../../test-utils/bill-documents";

type Who = { cookie: string; userId: string };

/**
 * D-250 — an expense's receipt is a file its submitter uploaded that
 * nothing else uses, so nobody can put a file they may not read onto their
 * own expense and read it through it. Requires local Postgres.
 */
describe("D-250 · an expense's receipt is the submitter's own upload (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let categoryId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const fieldUser: Who = { cookie: "", userId: "" };

  const callAs = (who: Who) => (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const upload = async (who: Who) => {
    const form = new FormData();
    form.append("file", new Blob([billPhoto()], { type: "image/png" }), "receipt.png");
    return (await json<{ id: string }>(await fetch(`${testApp.baseUrl}/files`, { method: "POST", headers: { cookie: who.cookie, "Idempotency-Key": randomUUID() }, body: form }))).id;
  };
  const expense = (receiptFileId: string | null) => ({ categoryId, date: "2026-10-16", currency: "USD", amount: "4200", receiptFileId });
  const refusal = async (res: Response) => ({ status: res.status, message: ((await res.json()) as { message: string }).message });

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "Priya Raman"], [staff, "Kavya Iyer"], [fieldUser, "Marcus Webb"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `d-250-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    for (const [who, role] of [[staff, "staff"], [fieldUser, "field"]] as const) {
      await db.delete(member).where(eq(member.userId, who.userId));
      await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
      await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    }
    const teams = await json<{ id: string; isDefault: boolean }[]>(await callAs(owner)("GET", "/org/teams"));
    const staffMember = (await db.select().from(member).where(eq(member.userId, staff.userId)))[0]!;
    await json(await callAs(owner)("PUT", `/org/teams/${teams.find((t) => t.isDefault)!.id}/members`, { memberIds: [staffMember.id] }));
    const [other] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    categoryId = (await db.insert(expenseCategories).values({ orgId, name: "Fuel", accountId: other!.id }).returning())[0]!.id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("refuses someone else's file, so a Field user can't read it through their own expense", async () => {
    const priyas = await upload(owner);
    expect(await refusal(await callAs(fieldUser)("POST", "/expenses", expense(priyas)))).toEqual({ status: 400, message: RECEIPT_UPLOAD_FIRST });
    expect((await callAs(fieldUser)("GET", `/files/${priyas}`)).status).toBe(404);
    // A file that doesn't exist (or is another organisation's) is refused the same way.
    expect(await refusal(await callAs(fieldUser)("POST", "/expenses", expense(randomUUID())))).toEqual({ status: 400, message: RECEIPT_UPLOAD_FIRST });
  });

  it("refuses a file another record already uses — another expense, or an attachment", async () => {
    const mine = await upload(fieldUser);
    await json(await callAs(fieldUser)("POST", "/expenses", expense(mine)));
    expect(await refusal(await callAs(fieldUser)("POST", "/expenses", expense(mine)))).toEqual({ status: 400, message: RECEIPT_IN_USE });

    const vendor = await json<{ id: string }>(await callAs(owner)("POST", "/contacts", { type: "vendor", name: "Apex Building Materials" }));
    const bill = await json<{ id: string }>(await callAs(owner)("POST", "/vendor-bills", { contactId: vendor.id, billNumber: "ABM-1", date: "2026-10-16", currency: "USD", lines: [] }));
    const attached = await upload(owner);
    await json(await callAs(owner)("POST", "/attachments", { entityType: "vendor_bill", entityId: bill.id, fileId: attached }));
    expect(await refusal(await callAs(owner)("POST", "/expenses", expense(attached)))).toEqual({ status: 400, message: RECEIPT_IN_USE });
  });

  it("takes the person's own fresh upload, keeps an expense's receipt on edit, and checks a new one", async () => {
    const first = await upload(staff);
    const created = await json<{ id: string; receiptFileId: string }>(await callAs(staff)("POST", "/expenses", expense(first)));
    expect(created.receiptFileId).toBe(first);
    // Saving with the same receipt is fine.
    await json(await callAs(staff)("PUT", `/expenses/${created.id}`, { receiptFileId: first, description: "Diesel" }));
    // Swapping in someone else's file isn't; a new upload of their own is.
    expect(await refusal(await callAs(staff)("PUT", `/expenses/${created.id}`, { receiptFileId: await upload(owner) }))).toEqual({ status: 400, message: RECEIPT_UPLOAD_FIRST });
    const second = await upload(staff);
    expect((await json<{ receiptFileId: string }>(await callAs(staff)("PUT", `/expenses/${created.id}`, { receiptFileId: second }))).receiptFileId).toBe(second);
    // An expense with no receipt still saves.
    await json(await callAs(staff)("POST", "/expenses", expense(null)));
  });
});
