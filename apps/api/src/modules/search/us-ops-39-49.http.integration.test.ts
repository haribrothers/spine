import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SearchRecentResponse, SearchResponse } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import {
  catalogItems,
  contactPersons,
  contacts,
  expenseCategories,
  expenses,
  invoices,
  leadStages,
  leads,
  meetings,
  member,
  quotes,
  session as sessionTable,
  user,
  vendorBills,
  vendorCredits,
} from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/**
 * US-OPS-39 to US-OPS-49 (D-238) — search finds leads, meetings, catalogue
 * items and vendor credits, contacts by phone, tax ID and their people, and
 * documents by amount; it narrows to an area, shows archived records when
 * asked, and keeps each person's recent records and searches. Requires
 * local Postgres.
 */
describe("US-OPS-39 to US-OPS-49 · search that finds more (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const ids: Record<string, string> = {};

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: { cookie: who.cookie, ...(method === "GET" ? {} : { "Idempotency-Key": randomUUID() }), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  const search = async (who: Who, q: string, extra = "") => (await (await call(who, "GET", `/search?q=${encodeURIComponent(q)}${extra}`)).json()) as SearchResponse;
  const group = (res: SearchResponse, type: string) => res.groups.find((g) => g.type === type);

  async function newUser(name: string): Promise<Who> {
    const email = `us-ops-39-${name.replace(/\s+/g, "-").toLowerCase()}-${randomUUID()}@example.com`;
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

    const [blue] = await db
      .insert(contacts)
      .values({ orgId, type: "customer", name: "Bluewater Hospitality Group", phone: "+1-555-0107", taxId: "29AABFL0000B1Z2", gstTreatment: "registered", createdByUserId: owner.userId })
      .returning();
    ids.blue = blue!.id;
    await db.insert(contactPersons).values({ contactId: blue!.id, name: "Priya Nair", email: "priya@bluewater.example", phone: "(555) 0199" });
    const [apex] = await db.insert(contacts).values({ orgId, type: "vendor", name: "Apex Timber Supply", createdByUserId: owner.userId }).returning();
    const [old] = await db.insert(contacts).values({ orgId, type: "customer", name: "Oldtown Traders", archivedAt: new Date(), createdByUserId: owner.userId }).returning();
    ids.old = old!.id;

    const [stage] = await db.insert(leadStages).values({ orgId, name: "Proposal", sortOrder: 99 }).returning();
    const [lead] = await db.insert(leads).values({ orgId, contactId: blue!.id, stageId: stage!.id, title: "Lobby refresh", valueAmount: 1280000n, valueCurrency: "USD", createdByUserId: owner.userId }).returning();
    ids.lead = lead!.id;
    const soon = new Date(Date.now() + 3 * 86_400_000);
    await db.insert(meetings).values([
      { orgId, contactId: blue!.id, title: "Site walk-through", location: "Bluewater lobby", startAt: soon, endAt: new Date(soon.getTime() + 3_600_000), organizerUserId: owner.userId, visibility: "org" },
      { orgId, title: "Bluewater pricing (private)", startAt: soon, endAt: new Date(soon.getTime() + 3_600_000), organizerUserId: owner.userId, visibility: "private" },
    ]);
    await db.insert(catalogItems).values([
      { orgId, name: "Drywall installation", category: "Interior", unit: "sq ft", defaultPriceAmount: 350n, defaultPriceCurrency: "USD", hsnSac: "995452", createdByUserId: owner.userId },
      { orgId, name: "Oldtown drywall", unit: "each", defaultPriceAmount: 100n, defaultPriceCurrency: "USD", archivedAt: new Date(), createdByUserId: owner.userId },
    ]);
    const [vcr] = await db
      .insert(vendorCredits)
      .values({ orgId, number: "VCR-0003", vendorReference: "CN-778", contactId: apex!.id, date: new Date(), status: "open", currency: "USD", totalAmount: 42000n, balanceAmount: 42000n, createdByUserId: owner.userId })
      .returning();
    ids.vcr = vcr!.id;

    // US-OPS-45: four documents for $2,389.50, and one for $2,389.00.
    const [q] = await db.insert(quotes).values({ orgId, contactId: blue!.id, status: "sent", number: "QUO-0011", currency: "USD", totalAmount: 238950n, createdByUserId: owner.userId }).returning();
    ids.quote = q!.id;
    const [inv] = await db
      .insert(invoices)
      .values({ orgId, contactId: blue!.id, status: "issued", number: "INV-0014", currency: "USD", totalAmount: 238950n, dueDate: new Date("2099-01-01T00:00:00Z"), createdByUserId: owner.userId })
      .returning();
    ids.inv = inv!.id;
    await db.insert(invoices).values({ orgId, contactId: blue!.id, status: "issued", number: "INV-0015", currency: "USD", totalAmount: 238900n, dueDate: new Date("2099-01-01T00:00:00Z"), createdByUserId: owner.userId });
    for (let i = 1; i <= 7; i++) await db.insert(invoices).values({ orgId, contactId: blue!.id, status: "draft", currency: "USD", totalAmount: 1000n, createdByUserId: owner.userId });
    await db.insert(vendorBills).values({ orgId, contactId: apex!.id, status: "recorded", billNumber: "BILL-8841", currency: "USD", date: new Date(), totalAmount: 238950n, createdByUserId: owner.userId });
    const [cat] = await db.insert(expenseCategories).values({ orgId, name: "Equipment hire" }).returning();
    await db.insert(expenses).values({ orgId, categoryId: cat!.id, date: new Date(), currency: "USD", amount: 238950n, submittedByUserId: owner.userId, number: "EXP-0009", description: "Scaffolding hire" });
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  describe("US-OPS-43", () => {
    it("finds leads, meetings, catalogue items and vendor credits, in the sidebar's order", async () => {
      const res = await search(owner, "bluewater");
      expect(res.groups.map((g) => g.type).slice(0, 3)).toEqual(["contacts", "leads", "meetings"]);
      expect(group(res, "leads")!.items[0]).toMatchObject({ id: ids.lead, type: "leads", title: "Lobby refresh", subtitle: "Bluewater Hospitality Group · $12,800.00", status: "Proposal", href: `/leads?lead=${ids.lead}` });
      const met = group(res, "meetings")!.items;
      expect(met.map((m) => m.title).sort()).toEqual(["Bluewater pricing (private)", "Site walk-through"]);
      expect(met[0]!.status).toBe("Upcoming");
      expect(met[0]!.href).toMatch(/^\/meetings\?id=/);

      expect(group(await search(owner, "995452"), "catalog_items")!.items[0]).toMatchObject({ title: "Drywall installation", subtitle: "Interior · $3.50", status: "Active" });
      const vcr = await search(owner, "VCR-3");
      expect(vcr.groups[0]!.type).toBe("vendor_credits");
      expect(vcr.groups[0]!.items[0]).toMatchObject({ id: ids.vcr, title: "VCR-0003", subtitle: "Apex Timber Supply · $420.00 left", status: "Open", href: `/vendor-credits/${ids.vcr}` });
      expect(group(await search(owner, "CN-778"), "vendor_credits")!.items[0]!.id).toBe(ids.vcr);
    });

    it("shows Field only the meetings the calendar shows them, and no leads or catalogue", async () => {
      const res = await search(field, "bluewater");
      expect(res.groups.map((g) => g.type)).toEqual(["meetings"]);
      expect(res.groups[0]!.items.map((m) => m.title)).toEqual(["Site walk-through"]);
      expect((await search(field, "drywall")).groups).toEqual([]);
    });
  });

  describe("US-OPS-44", () => {
    it("finds a contact by phone digits, tax ID or one of their people, and says what matched", async () => {
      const byPhone = group(await search(owner, "555 0107"), "contacts")!.items[0]!;
      expect(byPhone).toMatchObject({ id: ids.blue, subtitle: "Customer · Phone +1-555-0107", highlight: "+1-555-0107" });
      expect(group(await search(owner, "29aab fl"), "contacts")!.items[0]).toMatchObject({ id: ids.blue, subtitle: "Customer · GSTIN 29AABFL0000B1Z2" });
      expect(group(await search(owner, "Priya"), "contacts")!.items[0]).toMatchObject({ id: ids.blue, subtitle: "Customer · Contact: Priya Nair" });
      expect(group(await search(owner, "0199"), "contacts")!.items[0]).toMatchObject({ id: ids.blue, subtitle: "Customer · Contact: Priya Nair · (555) 0199", highlight: "(555) 0199" });
      expect(group(await search(owner, "555"), "contacts")).toBeUndefined();
      expect(group(await search(field, "555 0107"), "contacts")).toBeUndefined();
    });
  });

  describe("US-OPS-45", () => {
    it("finds documents by amount, first in their groups, and only the exact amount", async () => {
      for (const q of ["2,389.50", "$2,389.50", "2389.5"]) {
        const res = await search(owner, q);
        expect(res.groups.map((g) => g.type), q).toEqual(["quotes", "invoices", "vendor_bills", "expenses"]);
        expect(group(res, "invoices")!.items).toHaveLength(1);
        expect(group(res, "invoices")!.items[0]).toMatchObject({ id: ids.inv, subtitle: "Bluewater Hospitality Group · $2,389.50 due", highlight: "$2,389.50" });
        expect(group(res, "quotes")!.items[0]!.id).toBe(ids.quote);
      }
      expect(group(await search(owner, "2,389"), "invoices")!.items.map((i) => i.title)).toEqual(["INV-0015"]);
      expect((await search(field, "2,389.50")).groups).toEqual([]);
    });
  });

  describe("US-OPS-46", () => {
    it("leaves archived contacts and catalogue items out unless asked", async () => {
      expect((await search(owner, "oldtown")).groups).toEqual([]);
      const res = await search(owner, "oldtown", "&includeArchived=true");
      expect(group(res, "contacts")!.items[0]).toMatchObject({ id: ids.old, status: "Archived" });
      expect(group(res, "catalog_items")!.items[0]).toMatchObject({ title: "Oldtown drywall", status: "Archived" });
    });
  });

  describe("US-OPS-49", () => {
    it("narrows to the groups asked for, with up to 20 each", async () => {
      expect(group(await search(owner, "bluewater"), "invoices")!.items).toHaveLength(5);
      const billing = await search(owner, "bluewater", "&types=invoices,credit_notes,payments&limit=20");
      expect(billing.groups.map((g) => g.type)).toEqual(["invoices"]);
      expect(billing.groups[0]!.items).toHaveLength(9);
      expect((await call(owner, "GET", "/search?q=bluewater&types=widgets")).status).toBe(400);
    });
  });

  describe("US-OPS-39", () => {
    it("keeps each person's recent records and searches, newest first, re-checked on every read", async () => {
      expect((await call(owner, "POST", "/search/recent", { type: "invoices", id: ids.inv })).status).toBe(204);
      await call(owner, "POST", "/search/recent", { type: "contacts", id: ids.blue });
      await call(owner, "POST", "/search/recent", { type: "invoices", id: ids.inv });
      await call(owner, "POST", "/search/recent", { query: "bluewater" });
      await call(owner, "POST", "/search/recent", { query: "2,389.50" });
      await call(owner, "POST", "/search/recent", { query: "Bluewater" });
      await call(owner, "POST", "/search/recent", { query: "b" });
      const recent = (await (await call(owner, "GET", "/search/recent")).json()) as SearchRecentResponse;
      expect(recent.items.map((i) => [i.type, i.id])).toEqual([
        ["invoices", ids.inv],
        ["contacts", ids.blue],
      ]);
      expect(recent.items[0]).toMatchObject({ title: "INV-0014", status: "Issued", href: `/invoices/${ids.inv}` });
      expect(recent.searches).toEqual(["Bluewater", "2,389.50"]);

      // Another person sees none of it; Field never sees a record they can't open.
      await call(field, "POST", "/search/recent", { type: "invoices", id: ids.inv });
      expect((await (await call(field, "GET", "/search/recent")).json()) as SearchRecentResponse).toEqual({ items: [], searches: [] });

      expect((await call(owner, "POST", "/search/recent", { type: "widgets", id: ids.inv })).status).toBe(400);
      expect((await call(owner, "DELETE", "/search/recent")).status).toBe(204);
      expect((await (await call(owner, "GET", "/search/recent")).json()) as SearchRecentResponse).toEqual({ items: [], searches: [] });
    });
  });
});
