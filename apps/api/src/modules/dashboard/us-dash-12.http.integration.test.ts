import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AttentionItem } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import {
  contacts,
  expenseCategories,
  expenses,
  invoices,
  jobs,
  member,
  milestones,
  quotes,
  session as sessionTable,
  teamMemberships,
  teamPrivileges,
  teams,
  user,
  vendorBills,
} from "../../db/schema";
import { orgClock } from "../../common/org-clock";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

function addDays(date: string, days: number): Date {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * US-DASH-12 (D-087, D-088) — `GET /dashboard/attention`: one row per kind
 * in a fixed order, the first record named, kinds the member can't act on
 * left out, resolved items gone on the next read. Requires local Postgres.
 */
describe("US-DASH-12 · see what needs my attention first (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const staff: Who = { cookie: "", userId: "" };
  const plainStaff: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  let overdueInvoiceId: string;
  const today = orgClock().date;

  const attention = async (who: Who) => (await (await fetch(`${testApp.baseUrl}/dashboard/attention`, { headers: { cookie: who.cookie } })).json()) as AttentionItem[];

  async function newUser(name: string): Promise<Who> {
    const email = `us-dash-12-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  async function join(who: Who, role: "staff" | "field", grants: string[] = []) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role, createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    if (role === "staff") {
      const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
      if (grants.length) await db.insert(teamPrivileges).values(grants.map((capability) => ({ teamId: team!.id, capability, granted: true })));
      await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
    }
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("Alex Morgan"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(staff, await newUser("Sarah Mendes"));
    await join(staff, "staff", ["expenses.approve"]);
    Object.assign(plainStaff, await newUser("Plain Staff"));
    await join(plainStaff, "staff");
    Object.assign(field, await newUser("Marcus Webb"));
    await join(field, "field");

    const [customer] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const [vendor] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Ace Timber Supply", createdByUserId: owner.userId }).returning();
    const [invoice] = await db
      .insert(invoices)
      .values({ orgId, contactId: customer!.id, status: "issued", number: "INV-0002", currency: "USD", totalAmount: 454250n, dueDate: addDays(today, -12), createdByUserId: owner.userId })
      .returning();
    overdueInvoiceId = invoice!.id;

    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Travel" }).returning();
    await db.insert(expenses).values([
      { orgId, categoryId: category!.id, date: new Date(), currency: "USD", amount: 8500n, submittedByUserId: staff.userId },
      { orgId, categoryId: category!.id, date: new Date(), currency: "USD", amount: 19200n, submittedByUserId: field.userId },
    ]);

    await db.insert(quotes).values({ orgId, contactId: customer!.id, status: "draft", currency: "USD", subtotalAmount: 1600000n, discountAmount: 400000n, totalAmount: 1280000n, discountRequiresApproval: true, createdByUserId: owner.userId });
    await db.insert(quotes).values({ orgId, contactId: customer!.id, status: "sent", number: "QUO-0004", currency: "USD", totalAmount: 51000n, validUntil: addDays(today, 3), createdByUserId: owner.userId });
    await db.insert(quotes).values({ orgId, contactId: customer!.id, status: "sent", number: "QUO-0009", currency: "USD", totalAmount: 99000n, validUntil: addDays(today, 20), createdByUserId: owner.userId });

    const [job] = await db.insert(jobs).values({ orgId, contactId: customer!.id, name: "Marina office fit-out", number: `JOB-${randomUUID().slice(0, 4)}`, currency: "USD", costBudgetAmount: 0n, createdByUserId: owner.userId }).returning();
    await db.insert(milestones).values({ orgId, jobId: job!.id, name: "Mobilisation & site setup", status: "completed", completedByUserId: field.userId, completedAt: new Date() });

    await db.insert(vendorBills).values({ orgId, contactId: vendor!.id, status: "recorded", billNumber: "BILL-2231", currency: "USD", date: new Date(), totalAmount: 216000n, dueDate: addDays(today, 2), createdByUserId: owner.userId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("lists one row per kind in the set order, each with its count and first record", async () => {
    const rows = await attention(owner);
    expect(rows.map((r) => [r.kind, r.count])).toEqual([
      ["invoices_overdue", 1],
      ["expenses_awaiting_approval", 2],
      ["quotes_discount_approval", 1],
      ["milestones_to_invoice", 1],
      ["quotes_expiring", 1],
      ["vendor_bills_due", 1],
    ]);
    expect(rows[0]!.items[0]).toMatchObject({ id: overdueInvoiceId, number: "INV-0002", name: "Maple Ridge Developments", amount: "454250" });
    expect(rows[2]!.items[0]).toMatchObject({ name: "Maple Ridge Developments", amount: "1280000", note: "25% discount" });
    expect(rows[3]!.items[0]).toMatchObject({ name: "Mobilisation & site setup", party: "Marina office fit-out", note: "Marcus Webb" });
    expect(rows[4]!.items[0]).toMatchObject({ number: "QUO-0004" });
    expect(rows[5]!.items[0]).toMatchObject({ number: "BILL-2231", name: "Ace Timber Supply", amount: "216000" });
  });

  it("leaves out kinds the member can't act on, and Staff's own expenses (D-085)", async () => {
    const forStaff = await attention(staff);
    expect(forStaff.map((r) => r.kind)).toEqual(["invoices_overdue", "expenses_awaiting_approval"]);
    expect(forStaff[1]!.count).toBe(1);
    expect(forStaff[1]!.items[0]!.name).toBe("Marcus Webb");
    expect((await attention(plainStaff)).map((r) => r.kind)).toEqual(["invoices_overdue"]);
    expect(await attention(field)).toEqual([]);
  });

  it("a resolved item disappears on the next read", async () => {
    await db.update(invoices).set({ amountPaid: 454250n }).where(eq(invoices.id, overdueInvoiceId));
    expect((await attention(owner)).map((r) => r.kind)).not.toContain("invoices_overdue");
  });

  it("an organisation with nothing open gets an empty list", async () => {
    const fresh = await newUser("Fresh Owner");
    expect(await attention(fresh)).toEqual([]);
  });
});
