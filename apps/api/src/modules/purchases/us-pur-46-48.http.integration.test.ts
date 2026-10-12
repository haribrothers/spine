import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ExpenseCategoryUsage } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { expenseCategories, expenses, member, session as sessionTable, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

interface Who {
  cookie: string;
  userId: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  defaultTaxRateId: string | null;
  defaultTaxRateName: string | null;
  archivedAt: string | null;
}

/**
 * US-PUR-46, US-PUR-47, US-PUR-48 (D-228) — a category's "What it's for"
 * line and default tax rate, one name per business, and the figures only
 * Owners and Staff see. Requires local Postgres.
 */
describe("US-PUR-46 to US-PUR-48 · expense categories that guide (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const emails: string[] = [];
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  async function newUser(name: string): Promise<Who> {
    const email = `us-pur-46-${name}-${randomUUID()}@example.com`;
    emails.push(email);
    return signUp(testApp.baseUrl, { email, password: "testpassword123", name });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    Object.assign(owner, await newUser("owner"));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    Object.assign(field, await newUser("field"));
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("US-PUR-46, US-PUR-48: a category carries what it's for and its default tax rate; an archived rate can't be chosen", async () => {
    const rate = await json<{ id: string }>(await call(owner, "POST", "/tax-rates", { name: "GST 18%", rate: 18 }));
    const created = await json<Category>(
      await call(owner, "POST", "/expense-categories", { name: "  Materials ", description: " Cement, steel, sand — anything that goes into the build ", defaultTaxRateId: rate.id }),
    );
    expect(created).toMatchObject({ name: "Materials", description: "Cement, steel, sand — anything that goes into the build", defaultTaxRateId: rate.id });
    // Field reads the line and the rate too: they pick the category.
    const asField = await json<Category[]>(await call(field, "GET", "/expense-categories"));
    expect(asField.find((c) => c.id === created.id)).toMatchObject({ description: "Cement, steel, sand — anything that goes into the build", defaultTaxRateName: "GST 18%" });

    // Clearing the line, and a too-long one.
    expect((await json<Category>(await call(owner, "PUT", `/expense-categories/${created.id}`, { description: "" }))).description).toBeNull();
    const long = await call(owner, "PUT", `/expense-categories/${created.id}`, { description: "x".repeat(121) });
    expect(long.status).toBe(400);
    expect(await long.text()).toContain("Keep what it's for under 120 characters.");

    // An archived rate can't be newly chosen; the one already saved can stay.
    const old = await json<{ id: string }>(await call(owner, "POST", "/tax-rates", { name: "Old VAT", rate: 12 }));
    await json(await call(owner, "POST", `/tax-rates/${old.id}/archive`));
    const archivedRate = await call(owner, "PUT", `/expense-categories/${created.id}`, { defaultTaxRateId: old.id });
    expect(archivedRate.status).toBe(400);
    expect(await archivedRate.text()).toContain("Choose an active tax rate.");
    await json(await call(owner, "POST", `/tax-rates/${rate.id}/archive`));
    await json(await call(owner, "PUT", `/expense-categories/${created.id}`, { name: "Materials", defaultTaxRateId: rate.id }));
  });

  it("US-PUR-47: one name per business, ignoring case and spaces — archived ones too, with Restore offered", async () => {
    const fuel = await json<Category>(await call(owner, "POST", "/expense-categories", { name: "Fuel & freight" }));
    const clash = await call(owner, "POST", "/expense-categories", { name: " fuel & FREIGHT " });
    expect(clash.status).toBe(409);
    expect(await clash.json()).toMatchObject({ message: "Fuel & freight is already a category.", existingId: fuel.id, archived: false });

    await json(await call(owner, "POST", `/expense-categories/${fuel.id}/archive`));
    const archivedClash = await call(owner, "POST", "/expense-categories", { name: "Fuel & Freight" });
    expect(await archivedClash.json()).toMatchObject({ existingId: fuel.id, archived: true });

    // Renaming onto another's name is caught too; renaming to its own name isn't.
    const tools = await json<Category>(await call(owner, "POST", "/expense-categories", { name: "Tools" }));
    expect((await call(owner, "PUT", `/expense-categories/${tools.id}`, { name: "FUEL & FREIGHT" })).status).toBe(409);
    await json(await call(owner, "PUT", `/expense-categories/${tools.id}`, { name: "tools" }));

    // The database holds the line as well.
    await expect(db.insert(expenseCategories).values({ orgId, name: "TOOLS " })).rejects.toThrow();
  });

  it("US-PUR-46: the figures — every expense using each category and what was approved this month — are for Owners and Staff", async () => {
    const [site] = await db.insert(expenseCategories).values({ orgId, name: "Site meals" }).returning();
    const now = new Date();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
    const row = (amount: bigint, status: "submitted" | "approved" | "rejected", approvedAt: Date | null, currency = "USD") => ({
      orgId,
      categoryId: site!.id,
      date: now,
      currency,
      amount,
      status,
      approvedAt,
      submittedByUserId: owner.userId,
    });
    await db.insert(expenses).values([row(1800n, "approved", now), row(2200n, "approved", now), row(5000n, "approved", lastMonth), row(900n, "submitted", null), row(4000n, "approved", now, "EUR")]);

    const usage = await json<ExpenseCategoryUsage[]>(await call(owner, "GET", "/expense-categories/usage"));
    expect(usage.find((u) => u.categoryId === site!.id)).toEqual({ categoryId: site!.id, expenseCount: 5, approvedThisMonth: "4000" });
    expect((await call(field, "GET", "/expense-categories/usage")).status).toBe(403);

    // In use, it can't be deleted — and the message says to archive it.
    const del = await call(owner, "DELETE", `/expense-categories/${site!.id}`);
    expect(del.status).toBe(400);
    expect(await del.text()).toContain("Site meals is used by an expense, so it can't be deleted — archive it instead.");
    expect((await db.select().from(expenseCategories).where(eq(expenseCategories.id, site!.id))).length).toBe(1);
  });
});
