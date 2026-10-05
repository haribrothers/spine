import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { contacts, expenseCategories, expenses, jobAssignments, member, session as sessionTable, user, vendorBills } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-PUR-22 — `GET /vendor-bills?jobId=` and `GET /expenses?jobId=` list
 * only what's tagged to the job; Field filter only their own expenses, and
 * only on jobs they're assigned to. Requires local Postgres.
 */
describe("US-PUR-22 · filter bills and expenses by job (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  let jobA: string;
  let jobB: string;
  let categoryId: string;
  let vendorId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const get = async <T>(who: Who, path: string) => (await (await fetch(`${testApp.baseUrl}${path}`, { headers: { cookie: who.cookie } })).json()) as T;

  async function newUser(name: string): Promise<Who> {
    const email = `us-pur-22-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function expense(who: Who, jobId: string | null) {
    const [row] = await db.insert(expenses).values({ orgId, categoryId, jobId, date: new Date(), currency: "USD", amount: 6400n, submittedByUserId: who.userId }).returning();
    return row!.id;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    const [customer] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", createdByUserId: owner.userId }).returning();
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Coastal Timber Supply", createdByUserId: owner.userId }).returning();
    vendorId = vendor!.id;
    const post = async (name: string) =>
      (
        (await (
          await fetch(`${testApp.baseUrl}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie },
            body: JSON.stringify({ contactId: customer!.id, name, currency: "USD" }),
          })
        ).json()) as { id: string }
      ).id;
    jobA = await post("Marina office fit-out");
    jobB = await post("Phase 2 townhomes");
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Fuel & freight" }).returning();
    categoryId = category!.id;

    Object.assign(field, await newUser("field"));
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));
    await db.insert(jobAssignments).values({ jobId: jobA, userId: field.userId, orgId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("vendor bills filter to one job", async () => {
    const [onA] = await db.insert(vendorBills).values({ orgId, contactId: vendorId, currency: "USD", date: new Date(), billNumber: `B-${randomUUID().slice(0, 6)}`, jobId: jobA, createdByUserId: owner.userId }).returning();
    await db.insert(vendorBills).values({ orgId, contactId: vendorId, currency: "USD", date: new Date(), billNumber: `B-${randomUUID().slice(0, 6)}`, jobId: jobB, createdByUserId: owner.userId });
    await db.insert(vendorBills).values({ orgId, contactId: vendorId, currency: "USD", date: new Date(), billNumber: `B-${randomUUID().slice(0, 6)}`, createdByUserId: owner.userId });
    const bills = await get<{ id: string }[]>(owner, `/vendor-bills?jobId=${jobA}`);
    expect(bills.map((b) => b.id)).toEqual([onA!.id]);
    expect(await get<unknown[]>(owner, "/vendor-bills")).toHaveLength(3);
  });

  it("expenses filter to one job", async () => {
    const onA = await expense(owner, jobA);
    await expense(owner, jobB);
    await expense(owner, null);
    const rows = await get<{ id: string }[]>(owner, `/expenses?jobId=${jobA}`);
    expect(rows.map((r) => r.id)).toEqual([onA]);
  });

  it("Field users see only their own expenses on jobs they're assigned to", async () => {
    const mineOnA = await expense(field, jobA);
    await expense(field, jobB);
    expect((await get<{ id: string }[]>(field, `/expenses?jobId=${jobA}`)).map((r) => r.id)).toEqual([mineOnA]);
    expect(await get<unknown[]>(field, `/expenses?jobId=${jobB}`)).toEqual([]);
    expect((await get<{ id: string }[]>(field, "/jobs")).map((j) => j.id)).toEqual([jobA]);
  });
});
