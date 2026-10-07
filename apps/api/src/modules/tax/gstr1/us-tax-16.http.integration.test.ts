import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../../db/client";
import { auditLog, member, session as sessionTable } from "../../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../../test-utils/test-app";
import { GSTR1_SCHEMA_VERSION } from "./gstr1-build";

type Who = { cookie: string; userId: string };
const KA_GSTIN = "29AAACK0000A1ZK";

/** US-TAX-16 — GSTR-1 for a month or quarter, as a summary and a JSON file. Requires local Postgres. */
describe("US-TAX-16 · export GSTR-1 for the GST portal (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  // Credit notes count when they're issued, so the period is this month and the earlier invoice last month.
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)).toISOString().slice(0, 10);
  const fp = `${month.slice(5, 7)}${month.slice(0, 4)}`;
  let earlier: { id: string; number: string };
  let issued: string[] = [];

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [field, "field"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-tax-16-${name}-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));

    // Before GST is set up there's nothing to export.
    const early = await call(owner, "GET", `/exports/gstr1?period=${month}`);
    expect(early.status).toBe(400);
    expect(((await early.json()) as { message: string }).message).toBe("Set up GST first: add your GSTIN and state in Settings › GST.");

    await json(await call(owner, "PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } }));
    await json(await call(owner, "PUT", "/org/tax/profile", { country: "IN" }));
    await json(await call(owner, "PUT", "/org/tax/profile", { registrationNumber: KA_GSTIN, stateCode: "29", legalName: "Kaveri Interiors Private Limited" }));
    const gst18 = (await json<{ id: string; name: string }[]>(await call(owner, "GET", "/tax-groups"))).find((g) => g.name === "GST 18%")!.id;
    const contact = async (body: Record<string, unknown>) => (await json<{ id: string }>(await call(owner, "POST", "/contacts", { isCompany: true, ...body }))).id;
    const local = await contact({ type: "customer", name: "Lakeview Homes LLP", gstTreatment: "registered", taxId: "29AABFL0000B1ZA", addresses: [{ type: "billing", line1: "8 Indiranagar", stateCode: "29", isPrimary: true }] });
    const person = await contact({ type: "customer", name: "Anita Rao", isCompany: false, gstTreatment: "consumer", addresses: [{ type: "billing", line1: "MG Road", stateCode: "29", isPrimary: true }] });
    const issue = async (contactId: string, issueDate: string, lines: unknown[]) => {
      const draft = await json<{ id: string }>(await call(owner, "POST", "/invoices", { contactId, currency: "INR", issueDate, lines }));
      return json<{ id: string; number: string }>(await call(owner, "POST", `/invoices/${draft.id}/issue`));
    };
    const kitchen = { name: "Modular kitchen", quantity: 1, unitPriceAmount: "18000000", taxGroupId: gst18, hsnSac: "9403" };

    earlier = await issue(local, lastMonth, [kitchen]);
    const b2b = await issue(local, today, [kitchen, { name: "Installation", quantity: 1, unitPriceAmount: "2500000", taxGroupId: gst18, hsnSac: "995472" }]);
    const b2cs = await issue(person, today, [{ name: "Shoe rack", quantity: 2, unitPriceAmount: "500000", taxGroupId: gst18, hsnSac: "9403" }]);
    const voided = await issue(person, today, [{ name: "Shelf", quantity: 1, unitPriceAmount: "100000", taxGroupId: gst18, hsnSac: "9403" }]);
    await json(await call(owner, "POST", `/invoices/${voided.id}/void`, { reason: "Raised twice" }));
    issued = [b2b.number, b2cs.number, voided.number];
    const credit = await json<{ id: string }>(await call(owner, "POST", "/credit-notes", { invoiceId: earlier.id, lines: [{ name: "Two doors returned", quantity: 1, unitPriceAmount: "1000000", taxRatePercentage: 18, hsnSac: "9403" }] }));
    await json(await call(owner, "POST", `/credit-notes/${credit.id}/issue`));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("shows counts and values per table for the month", async () => {
    const summary = await json<{
      gstin: string;
      period: { label: string };
      tables: Record<string, { count: number; taxableValue: string; tax: string }>;
      totals: { documents: number; tax: string };
      footer: string;
    }>(await call(owner, "GET", `/exports/gstr1?period=${month}`));
    expect(summary.gstin).toBe(KA_GSTIN);
    expect(summary.tables.b2b).toEqual({ count: 1, taxableValue: "20500000", tax: "3690000" });
    expect(summary.tables.b2cs).toEqual({ count: 1, taxableValue: "1000000", tax: "180000" });
    expect(summary.tables.cdnr).toEqual({ count: 1, taxableValue: "-1000000", tax: "-180000" });
    for (const table of ["b2cl", "cdnur", "exp"]) expect(summary.tables[table]!.count).toBe(0);
    expect(summary.tables.hsn).toMatchObject({ count: 2 });
    expect(summary.totals).toMatchObject({ documents: 4, tax: "3690000" });
    expect(summary.footer).toBe("Spine prepares this file; it doesn't file your return. Check it, then upload it on the GST portal.");
  });

  it("downloads the JSON with the GSTIN, the period and the schema version; the download is audited", async () => {
    const res = await call(owner, "GET", `/exports/gstr1?period=${month}&format=json`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(`GSTR1_${KA_GSTIN}_${fp}.json`);
    const file = (await res.json()) as Record<string, unknown> & { cdnr: { nt: Record<string, unknown>[] }[]; doc_issue: { doc_det: { doc_num: number; docs: Record<string, unknown>[] }[] } };
    expect(file).toMatchObject({ gstin: KA_GSTIN, fp, version: GSTR1_SCHEMA_VERSION });
    // A credit note this month on last month's invoice: CDNR, with the original invoice's number and date.
    expect(file.cdnr[0]!.nt[0]).toMatchObject({ ntty: "C", inum: earlier.number, idt: `${lastMonth.slice(8, 10)}-${lastMonth.slice(5, 7)}-${lastMonth.slice(0, 4)}` });
    // Documents issued: the month's invoice range with the voided one counted, and the credit note.
    const invoicesIssued = file.doc_issue.doc_det.find((d) => d.doc_num === 1)!.docs[0]!;
    expect(invoicesIssued).toMatchObject({ from: issued[0], to: issued[2], totnum: 3, cancel: 1, net_issue: 2 });
    expect(file.doc_issue.doc_det.find((d) => d.doc_num === 5)!.docs[0]).toMatchObject({ totnum: 1, cancel: 0 });
    const audited = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "gstr1_export")));
    expect(audited).toHaveLength(1);
    expect(audited[0]).toMatchObject({ action: "downloaded", actorUserId: owner.userId });
  });

  it("takes a quarter, and refuses a period it can't read", async () => {
    const quarter = `${month.slice(0, 4)}-Q${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`;
    const summary = await json<{ period: { kind: string }; tables: { b2b: { count: number } } }>(await call(owner, "GET", `/exports/gstr1?period=${quarter}`));
    expect(summary.period.kind).toBe("quarterly");
    expect(summary.tables.b2b.count).toBeGreaterThanOrEqual(1);
    const bad = await call(owner, "GET", "/exports/gstr1?period=September");
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toBe("Choose a month (YYYY-MM) or a quarter (YYYY-Q1 to YYYY-Q4).");
  });

  it("Field users can't export GSTR-1", async () => {
    expect((await call(field, "GET", `/exports/gstr1?period=${month}`)).status).toBe(403);
  });
});
