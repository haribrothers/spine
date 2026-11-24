import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { catalogItems, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

interface Item {
  id: string;
  name: string;
  category: string | null;
  defaultTaxRateId: string | null;
  defaultTaxGroupId: string | null;
  defaultTaxRatePercentage: number;
  interTaxRateId: string | null;
  interTaxGroupId: string | null;
  supplyClass: string;
  incomeAccountId: string | null;
  archivedAt: string | null;
}

/**
 * US-CAT-12 (D-213) — changing, archiving and restoring several catalogue
 * items at once, all or nothing, with each item's own/others right checked;
 * and Import reading Category. Requires local Postgres.
 */
describe("US-CAT-12 · change many items at once (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const email = `us-cat-12-${randomUUID()}@example.com`;
  const staffEmail = `us-cat-12-staff-${randomUUID()}@example.com`;
  let cookie: string;
  let staffCookie: string;

  const call = (method: string, route: string, body?: unknown, who = cookie) =>
    fetch(`${testApp.baseUrl}${route}`, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const json = async <T>(res: Response) => (await res.json()) as T;
  const addItem = async (name: string, who = cookie) =>
    json<Item>(await call("POST", "/catalog-items", { name, unit: "each", defaultPriceAmount: "10000", defaultPriceCurrency: "USD" }, who));
  const get = async (id: string) => json<Item>(await call("GET", `/catalog-items/${id}`));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    const orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;

    // Staff whose Team may change only the items they created.
    const staff = await signUp(testApp.baseUrl, { email: staffEmail, password: "testpassword123", name: "Staff" });
    staffCookie = staff.cookie;
    await db.delete(member).where(eq(member.userId, staff.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: staff.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, staff.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Own catalogue ${randomUUID()}` }).returning();
    await db.insert(teamPrivileges).values([
      { teamId: team!.id, capability: "catalog.open", granted: true },
      { teamId: team!.id, capability: "catalog.edit_own", granted: true },
      { teamId: team!.id, capability: "catalog.delete_own", granted: true },
    ]);
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, [email, staffEmail]));
  });

  it("sets a category, a tax and an income account on every selected item in one save", async () => {
    const a = await addItem("Cement bag");
    const b = await addItem("Tiling");
    const rate = await json<{ id: string }>(await call("POST", "/tax-rates", { name: `Sales tax ${randomUUID().slice(0, 6)}`, rate: 18 }));
    const accounts = await json<Record<string, { id: string; code: string }[]>>(await call("GET", "/org/accounts"));
    const income = accounts.income!.find((acct) => acct.code !== "4100")!;

    const res = await call("POST", "/catalog-items/bulk", { ids: [a.id, b.id], action: "update", changes: { category: "Materials", defaultTaxRateId: rate.id, incomeAccountId: income.id } });
    expect(res.status).toBeLessThan(300);
    expect(await json(res)).toEqual({ updated: 2 });
    for (const id of [a.id, b.id]) {
      expect(await get(id)).toMatchObject({ category: "Materials", defaultTaxRateId: rate.id, defaultTaxRatePercentage: 18, supplyClass: "taxable", incomeAccountId: income.id });
    }

    // "No tax" clears it again.
    await call("POST", "/catalog-items/bulk", { ids: [a.id], action: "update", changes: { defaultTaxRateId: null, defaultTaxGroupId: null } });
    expect(await get(a.id)).toMatchObject({ defaultTaxRateId: null, defaultTaxRatePercentage: 0 });
  });

  it("archives and restores the selection", async () => {
    const a = await addItem("Scaffold hire");
    const b = await addItem("Skip hire");
    expect((await call("POST", "/catalog-items/bulk", { ids: [a.id, b.id], action: "archive" })).status).toBeLessThan(300);
    expect((await get(a.id)).archivedAt).not.toBeNull();
    expect((await get(b.id)).archivedAt).not.toBeNull();
    expect((await call("POST", "/catalog-items/bulk", { ids: [a.id, b.id], action: "restore" })).status).toBeLessThan(300);
    expect((await get(a.id)).archivedAt).toBeNull();
  });

  it("changes nothing when some items can't be changed, and says how many", async () => {
    const mine = await addItem("Staff's own item", staffCookie);
    const owners = await addItem("Owner's item");
    const res = await call("POST", "/catalog-items/bulk", { ids: [mine.id, owners.id], action: "update", changes: { category: "Labour" } }, staffCookie);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { message: string }).message).toBe("You can't change 1 of these items. Unselect them and try again.");
    expect((await get(mine.id)).category).toBeNull();
    expect((await call("POST", "/catalog-items/bulk", { ids: [mine.id, owners.id], action: "archive" }, staffCookie)).status).toBe(403);
    expect((await get(owners.id)).archivedAt).toBeNull();
    // Their own items alone are fine.
    expect((await call("POST", "/catalog-items/bulk", { ids: [mine.id], action: "update", changes: { category: "Labour" } }, staffCookie)).status).toBeLessThan(300);
  });

  it("refuses unknown items and an account that isn't an income account", async () => {
    const a = await addItem("Plastering");
    expect((await call("POST", "/catalog-items/bulk", { ids: [a.id, randomUUID()], action: "archive" })).status).toBe(404);
    const accounts = await json<Record<string, { id: string }[]>>(await call("GET", "/org/accounts"));
    const res = await call("POST", "/catalog-items/bulk", { ids: [a.id], action: "update", changes: { incomeAccountId: accounts.expense![0]!.id } });
    expect(res.status).toBe(400);
    expect((await call("POST", "/catalog-items/bulk", { ids: [a.id], action: "update" })).status).toBe(400);
  });

  it("sets a GST business's inter-state tax alongside, when it's given", async () => {
    const a = await addItem("Waterproofing");
    const cgst = await json<{ id: string }>(await call("POST", "/tax-rates", { name: `CGST 9% ${randomUUID().slice(0, 6)}`, rate: 9, taxType: "cgst" }));
    const sgst = await json<{ id: string }>(await call("POST", "/tax-rates", { name: `SGST 9% ${randomUUID().slice(0, 6)}`, rate: 9, taxType: "sgst" }));
    const group = await json<{ id: string }>(await call("POST", "/tax-groups", { name: `GST 18% ${randomUUID().slice(0, 6)}`, taxRateIds: [cgst.id, sgst.id] }));
    const igst = await json<{ id: string }>(await call("POST", "/tax-rates", { name: `IGST 18% ${randomUUID().slice(0, 6)}`, rate: 18, taxType: "igst" }));
    const res = await call("POST", "/catalog-items/bulk", { ids: [a.id], action: "update", changes: { defaultTaxGroupId: group.id, interTaxRateId: igst.id, interTaxGroupId: null } });
    expect(res.status).toBeLessThan(300);
    expect(await get(a.id)).toMatchObject({ defaultTaxGroupId: group.id, defaultTaxRatePercentage: 18, interTaxRateId: igst.id, interTaxGroupId: null });
    // No tax clears both.
    await call("POST", "/catalog-items/bulk", { ids: [a.id], action: "update", changes: { defaultTaxRateId: null, defaultTaxGroupId: null, interTaxRateId: null, interTaxGroupId: null } });
    expect(await get(a.id)).toMatchObject({ defaultTaxGroupId: null, interTaxRateId: null });
    // An inter-state tax that isn't one of the organisation's is refused, and nothing changes.
    expect((await call("POST", "/catalog-items/bulk", { ids: [a.id], action: "update", changes: { interTaxRateId: randomUUID() } })).status).toBeGreaterThanOrEqual(400);
  });

  it("imports Category, so an exported file imports back", async () => {
    const name = `Imported ${randomUUID().slice(0, 6)}`;
    const res = await call("POST", "/catalog-items/import", { rows: [{ row: 2, name, unit: "hour", category: "Labour", price: "45" }] });
    expect(res.status).toBeLessThan(300);
    const [row] = await db.select().from(catalogItems).where(eq(catalogItems.name, name));
    expect(row?.category).toBe("Labour");
  });
});
