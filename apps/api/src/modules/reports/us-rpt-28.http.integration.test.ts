import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createInvoiceSchema, type SalesByCustomerReport, type SalesByItemReport } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { catalogItems, contacts, member, session as sessionTable, teamMemberships, teamPrivileges, teams, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { InvoicesService } from "../invoices/invoices.service";

type Who = { cookie: string; userId: string };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** US-RPT-28 — sales by customer (from the ledger, net of credit notes) and by item (from invoice lines). Requires local Postgres. */
describe("US-RPT-28 · see sales by customer and by item (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const ids = {} as Record<"fitout" | "visit" | "maple" | "harbour" | "inv1" | "inv2" | "inv3", string>;
  const from = `${new Date().getFullYear()}-01-01`;
  const to = iso(new Date());
  const owner: Who = { cookie: "", userId: "" };
  const accountant: Who = { cookie: "", userId: "" };
  const ledgerOnly: Who = { cookie: "", userId: "" };

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  async function join(who: Who, grants: string[]) {
    await db.delete(member).where(eq(member.userId, who.userId));
    const memberId = randomUUID();
    await db.insert(member).values({ id: memberId, organizationId: orgId, userId: who.userId, role: "staff", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, who.userId));
    const [team] = await db.insert(teams).values({ orgId, name: `Team ${randomUUID()}` }).returning();
    for (const capability of grants) await db.insert(teamPrivileges).values({ teamId: team!.id, capability, granted: true });
    await db.insert(teamMemberships).values({ teamId: team!.id, memberId });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [accountant, "accountant"], [ledgerOnly, "ledger"]] as const) {
      const email = `us-rpt-28-${name}-${randomUUID()}@example.com`;
      emails.push(email);
      Object.assign(who, await signUp(testApp.baseUrl, { email, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await join(accountant, ["reports.view_financial_statements"]);
    await join(ledgerOnly, ["ledger.view"]);

    for (const [key, name] of [["fitout", "Kitchen fit-out"], ["visit", "Site visit"]] as const) {
      ids[key] = (await db.insert(catalogItems).values({ orgId, name, unit: "each", defaultPriceAmount: 100n, defaultPriceCurrency: "USD", createdByUserId: owner.userId }).returning())[0]!.id;
    }
    for (const [key, name] of [["maple", "Maple Ridge Developments"], ["harbour", "Harbour View Strata"]] as const) {
      ids[key] = (await db.insert(contacts).values({ orgId, type: "customer", name, createdByUserId: owner.userId }).returning())[0]!.id;
    }
    const service = testApp.app.get(InvoicesService);
    const issue = async (contactId: string, lines: { name: string; quantity: number; unitPriceAmount: string; catalogItemId?: string }[]) =>
      (await service.issue(orgId, (await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId, currency: "USD", lines }))).id, owner.userId)).id;
    ids.inv1 = await issue(ids.maple, [
      { name: "Kitchen fit-out", quantity: 2, unitPriceAmount: "100000", catalogItemId: ids.fitout },
      { name: "Custom shelving", quantity: 1, unitPriceAmount: "50000" },
    ]);
    ids.inv2 = await issue(ids.maple, [{ name: "Site visit", quantity: 3, unitPriceAmount: "10000", catalogItemId: ids.visit }]);
    ids.inv3 = await issue(ids.harbour, [{ name: "Kitchen fit-out", quantity: 1, unitPriceAmount: "100000", catalogItemId: ids.fitout }]);
    // A draft isn't a sale.
    await service.create(orgId, owner.userId, createInvoiceSchema.parse({ contactId: ids.harbour, currency: "USD", lines: [{ name: "Site visit", quantity: 9, unitPriceAmount: "10000", catalogItemId: ids.visit }] }));
    // One fit-out credited back.
    const note = await json<{ id: string }>(
      await call(owner, "POST", "/credit-notes", { invoiceId: ids.inv1, lines: [{ type: "item", name: "Kitchen fit-out", quantity: 1, unitPriceAmount: "100000", taxRatePercentage: 0, catalogItemId: ids.fitout }] }),
    );
    await json(await call(owner, "POST", `/credit-notes/${note.id}/issue`));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("each customer: invoice count, sales before tax, tax, total and % of sales, largest first, net of credit notes", async () => {
    const report = await json<SalesByCustomerReport>(await call(owner, "GET", `/reports/sales-by-customer?from=${from}&to=${to}`));
    expect(report.rows.map((r) => [r.name, r.invoiceCount, r.salesBeforeTax, r.percentOfSales])).toEqual([
      ["Maple Ridge Developments", 2, "180000", "64.3"],
      ["Harbour View Strata", 1, "100000", "35.7"],
    ]);
    for (const r of report.rows) expect(BigInt(r.total)).toBe(BigInt(r.salesBeforeTax) + BigInt(r.tax));
    expect(report.totals).toMatchObject({ customers: 2, invoiceCount: 3, salesBeforeTax: "280000" });
  });

  it("a customer's row lists its invoices", async () => {
    const report = await json<SalesByCustomerReport>(await call(owner, "GET", `/reports/sales-by-customer?from=${from}&to=${to}`));
    expect(report.rows[0]!.invoices.map((i) => i.href).sort()).toEqual([`/invoices/${ids.inv1}`, `/invoices/${ids.inv2}`].sort());
  });

  it("each catalogue item: quantity, sales before tax and average price; typed lines as 'Items not from the catalogue'", async () => {
    const report = await json<SalesByItemReport>(await call(owner, "GET", `/reports/sales-by-item?from=${from}&to=${to}`));
    expect(report.rows.map((r) => [r.name, r.quantity, r.salesBeforeTax, r.averagePrice])).toEqual([
      ["Kitchen fit-out", 2, "200000", "100000"],
      ["Site visit", 3, "30000", "10000"],
      ["Items not from the catalogue", 1, "50000", "50000"],
    ]);
    expect(report.rows[0]!.invoices.map((i) => i.id).sort()).toEqual([ids.inv1, ids.inv3].sort());
    expect(report.totals.salesBeforeTax).toBe("280000");
  });

  it("a range with no sales is empty", async () => {
    const report = await json<SalesByCustomerReport>(await call(owner, "GET", "/reports/sales-by-customer?from=2020-01-01&to=2020-12-31"));
    expect(report.rows).toEqual([]);
  });

  it("Staff need 'View financial statements'; bad ranges are refused", async () => {
    for (const path of ["sales-by-customer", "sales-by-item"]) {
      expect((await call(accountant, "GET", `/reports/${path}?from=${from}&to=${to}`)).status).toBe(200);
      expect((await call(ledgerOnly, "GET", `/reports/${path}?from=${from}&to=${to}`)).status).toBe(403);
      expect((await call(owner, "GET", `/reports/${path}?from=${to}&to=2020-01-01`)).status).toBe(400);
    }
  });
});
