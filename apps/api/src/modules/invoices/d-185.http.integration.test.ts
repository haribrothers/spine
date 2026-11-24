import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../db/client";
import { fiscalPeriods, journalEntries, member } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

/** D-185 (Q-20) — an invoice posts on its issue date. Requires local Postgres. */
describe("D-185 · invoices post on their issue date (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let cookie = "";
  let contactId = "";
  let gst18 = "";
  const now = new Date();
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 12)).toISOString().slice(0, 10);
  const period = lastMonth.slice(0, 7);
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const draft = async (issueDate: string) =>
    json<{ id: string }>(await call("POST", "/invoices", { contactId, currency: "INR", issueDate, lines: [{ name: "Modular kitchen", quantity: 1, unitPriceAmount: "18000000", taxGroupId: gst18, hsnSac: "9403" }] }));

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email: `d-185-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await json(await call("PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } }));
    await json(await call("PUT", "/org/tax/profile", { country: "IN" }));
    await json(await call("PUT", "/org/tax/profile", { registrationNumber: "29AAACK0000A1ZK", stateCode: "29", legalName: "Kaveri Interiors Private Limited" }));
    gst18 = (await json<{ id: string; name: string }[]>(await call("GET", "/tax-groups"))).find((g) => g.name === "GST 18%")!.id;
    contactId = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", name: "Anita Rao", gstTreatment: "consumer", addresses: [{ type: "billing", line1: "MG Road", stateCode: "29", isPrimary: true }] }))).id;
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("a backdated invoice posts on its issue date, so the Tax Summary and GSTR-1 agree for that month", async () => {
    const invoice = await draft(lastMonth);
    await json(await call("POST", `/invoices/${invoice.id}/issue`));
    const [entry] = await db.select().from(journalEntries).where(and(eq(journalEntries.orgId, orgId), eq(journalEntries.sourceType, "invoice"), eq(journalEntries.sourceId, invoice.id)));
    expect(entry!.date).toBe(lastMonth);
    const summary = await json<{ totals: { tax: string }; taxSummaryTax: string; totalsMatchTaxSummary: boolean }>(await call("GET", `/exports/gstr1?period=${period}`));
    expect(summary.totals.tax).toBe("3240000");
    expect(summary.totalsMatchTaxSummary).toBe(true);
  });

  it("an issue date in a closed period is refused", async () => {
    await db.insert(fiscalPeriods).values({ orgId, startDate: `${period}-01`, endDate: lastDay, isClosed: true });
    const invoice = await draft(lastMonth);
    const res = await call("POST", `/invoices/${invoice.id}/issue`);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toContain("falls within a closed fiscal period");
  });
});
