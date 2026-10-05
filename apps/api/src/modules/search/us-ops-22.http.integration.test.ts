import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SearchResponse } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { contacts, expenseCategories, expenses, invoices, jobAssignments, jobs, member, quotes, session as sessionTable, user, vendorBills } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-OPS-22 (D-095) — `GET /search?q=`: contacts, quotes, jobs, invoices,
 * vendor bills and expenses, up to 5 each, each with a second line and a
 * status; a document number first; nothing a member can't read. Requires
 * local Postgres.
 */
describe("US-OPS-22 · search everything from anywhere (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const ids: Record<string, string> = {};

  const search = async (who: Who, q: string) => (await (await fetch(`${testApp.baseUrl}/search?q=${encodeURIComponent(q)}&limit=5`, { headers: { cookie: who.cookie } })).json()) as SearchResponse;

  async function newUser(name: string): Promise<Who> {
    const email = `us-ops-22-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("Alex Morgan"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(field, await newUser("Marcus Webb"));
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));

    const [harbor] = await db.insert(contacts).values({ orgId, type: "customer", name: "Harborview Construction Co.", email: "ap@harborview.example", createdByUserId: owner.userId }).returning();
    const [timber] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Harbor Timber Supply", createdByUserId: owner.userId }).returning();
    ids.harbor = harbor!.id;
    const [q4] = await db.insert(quotes).values({ orgId, contactId: harbor!.id, status: "sent", number: "QUO-0004", currency: "USD", totalAmount: 51000n, createdByUserId: owner.userId }).returning();
    ids.q4 = q4!.id;
    await db.insert(quotes).values({ orgId, contactId: harbor!.id, status: "accepted", number: "QUO-0001", currency: "USD", totalAmount: 4850000n, createdByUserId: owner.userId });
    const [job] = await db.insert(jobs).values({ orgId, contactId: harbor!.id, number: "JOB-001", name: "Marina office fit-out", siteAddress: "48 Harbor Way, Portland, ME 04101", currency: "USD", createdByUserId: owner.userId }).returning();
    ids.job = job!.id;
    await db.insert(jobAssignments).values({ orgId, jobId: job!.id, userId: field.userId });
    await db.insert(jobs).values({ orgId, contactId: harbor!.id, number: "JOB-002", name: "Harbor deck repairs", currency: "USD", createdByUserId: owner.userId });
    const [inv] = await db
      .insert(invoices)
      .values({ orgId, contactId: harbor!.id, status: "issued", number: "INV-0010", currency: "USD", totalAmount: 970000n, dueDate: new Date("2026-01-01T00:00:00Z"), createdByUserId: owner.userId })
      .returning();
    ids.inv = inv!.id;
    for (let i = 1; i <= 7; i++) await db.insert(invoices).values({ orgId, contactId: harbor!.id, status: "draft", currency: "USD", totalAmount: 1000n, createdByUserId: owner.userId });
    await db.insert(vendorBills).values({ orgId, contactId: timber!.id, status: "recorded", billNumber: "BILL-2231", currency: "USD", date: new Date(), totalAmount: 216000n, createdByUserId: owner.userId });
    const [cat] = await db.insert(expenseCategories).values({ orgId, name: "Harbor parking" }).returning();
    await db.insert(expenses).values([
      { orgId, categoryId: cat!.id, date: new Date(), currency: "USD", amount: 1200n, submittedByUserId: field.userId, number: "EXP-0001" },
      { orgId, categoryId: cat!.id, date: new Date(), currency: "USD", amount: 900n, submittedByUserId: owner.userId, number: "EXP-0002" },
    ]);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("groups results by type, up to 5 each, with a second line and a status", async () => {
    const res = await search(owner, "harbor");
    expect(res.groups.map((g) => g.label)).toEqual(["Contacts", "Quotes", "Jobs", "Invoices", "Vendor bills", "Expenses"]);
    for (const g of res.groups) expect(g.items.length).toBeLessThanOrEqual(5);
    expect(res.groups[3]!.items).toHaveLength(5);
    const contact = res.groups[0]!.items.find((i) => i.id === ids.harbor)!;
    expect(contact).toMatchObject({ title: "Harborview Construction Co.", subtitle: "Customer · ap@harborview.example", status: "Contact", href: `/contacts/${ids.harbor}` });
    expect(res.groups[1]!.items.find((i) => i.id === ids.q4)).toMatchObject({ title: "QUO-0004", subtitle: "Harborview Construction Co. · $510.00", status: "Sent" });
    expect(res.groups[2]!.items.find((i) => i.id === ids.job)).toMatchObject({ title: "JOB-001 · Marina office fit-out", subtitle: "48 Harbor Way, Portland, ME 04101", status: "Active" });
    expect(res.groups[4]!.items[0]).toMatchObject({ title: "BILL-2231 · Harbor Timber Supply", status: "Unpaid" });
  });

  it("a document number is the first result, however it's typed", async () => {
    const inv = await search(owner, "INV-0010");
    expect(inv.groups[0]!.type).toBe("invoices");
    expect(inv.groups[0]!.items[0]).toMatchObject({ id: ids.inv, title: "INV-0010", subtitle: "Harborview Construction Co. · $9,700.00 due", status: "Overdue", href: `/invoices/${ids.inv}` });
    const quote = await search(owner, "QUO-4");
    expect(quote.groups[0]!.type).toBe("quotes");
    expect(quote.groups[0]!.items[0]!.id).toBe(ids.q4);
  });

  it("never shows what the member can't read: Field get their jobs and their own expenses only", async () => {
    const res = await search(field, "harbor");
    expect(res.groups.map((g) => g.type)).toEqual(["jobs", "expenses"]);
    expect(res.groups[0]!.items.map((i) => i.id)).toEqual([ids.job]);
    expect(res.groups[1]!.items.map((i) => i.title)).toEqual(["EXP-0001 · Harbor parking"]);
    expect((await search(field, "INV-0010")).groups).toEqual([]);
  });

  it("needs 2 characters, and returns nothing when nothing matches", async () => {
    expect((await search(owner, "h")).groups).toEqual([]);
    expect(await search(owner, "zzqqxx")).toEqual({ query: "zzqqxx", groups: [] });
  });

  it("answers within 500 ms at 10,000 contacts", async () => {
    const rows = Array.from({ length: 10_000 }, (_, i) => ({ orgId, type: "customer" as const, name: `Bulk customer ${i} ${randomUUID().slice(0, 6)}`, createdByUserId: owner.userId }));
    for (let i = 0; i < rows.length; i += 2000) await db.insert(contacts).values(rows.slice(i, i + 2000));
    const times: number[] = [];
    for (const q of ["harbor", "bulk customer 99", "INV-0010", "parking", "marina"]) {
      const started = performance.now();
      await search(owner, q);
      times.push(performance.now() - started);
    }
    expect(Math.max(...times)).toBeLessThan(500);
  }, 60_000);
});
