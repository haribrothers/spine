import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "../../../db/client";
import { accounts, auditLog, contacts, invoices, member } from "../../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../../test-utils/test-app";
import { LedgerService } from "../../ledger/ledger.service";

const KA_GSTIN = "29AAACK0000A1ZK";

interface Summary {
  tables: Record<string, { count: number; taxableValue: string; tax: string }>;
  totals: { tax: string };
  taxSummaryTax: string;
  totalsMatchTaxSummary: boolean;
  problems: { kind: string; recordId: string | null; label: string; href: string; action: string }[];
}

/** US-TAX-17 — problems before uploading, the Excel workbook, and the totals check. Requires local Postgres. */
describe("US-TAX-17 · check GSTR-1 figures before uploading (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let cookie = "";
  let ownerId = "";
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 10);
  let gst18 = "";
  const ids: Record<string, string> = {};
  const numbers: Record<string, string> = {};

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const summary = async () => json<Summary>(await call("GET", `/exports/gstr1?period=${month}`));
  const issue = async (key: string, contactId: string, lines: unknown[]) => {
    const draft = await json<{ id: string }>(await call("POST", "/invoices", { contactId, currency: "INR", issueDate: today, lines }));
    const issued = await json<{ id: string; number: string }>(await call("POST", `/invoices/${draft.id}/issue`));
    ids[key] = issued.id;
    numbers[key] = issued.number;
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email: `us-tax-17-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    ownerId = owner.userId;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await json(await call("PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } }));
    await json(await call("PUT", "/org/tax/profile", { country: "IN" }));
    await json(await call("PUT", "/org/tax/profile", { registrationNumber: KA_GSTIN, stateCode: "29", legalName: "Kaveri Interiors Private Limited" }));
    gst18 = (await json<{ id: string; name: string }[]>(await call("GET", "/tax-groups"))).find((g) => g.name === "GST 18%")!.id;
    const contact = async (key: string, body: Record<string, unknown>) =>
      (ids[key] = (await json<{ id: string }>(await call("POST", "/contacts", { type: "customer", isCompany: true, addresses: [{ type: "billing", line1: "Site", stateCode: "29", isPrimary: true }], ...body }))).id);
    await contact("lakeview", { name: "Lakeview Homes LLP", gstTreatment: "registered", taxId: "29AABFL0000B1ZA" });
    await contact("harbour", { name: "Harbour Café LLP", gstTreatment: "registered", taxId: "29AABFL0000B1ZA" });
    await contact("anita", { name: "Anita Rao", isCompany: false, gstTreatment: "consumer" });
    await issue("clean", ids.lakeview!, [{ name: "Modular kitchen", quantity: 1, unitPriceAmount: "18000000", taxGroupId: gst18, hsnSac: "9403" }]);
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("with everything in order there's nothing to fix, and the file's total tax equals the Tax Summary's tax collected", async () => {
    const s = await summary();
    expect(s.problems).toEqual([]);
    expect(s.totals.tax).toBe("3240000");
    const taxSummary = await json<{ taxCollected: string }>(await call("GET", `/org/tax/summary?from=${month}-01&to=${today}`));
    expect(s.taxSummaryTax).toBe(taxSummary.taxCollected);
    expect(s.totals.tax).toBe(taxSummary.taxCollected);
    expect(s.totalsMatchTaxSummary).toBe(true);
  });

  it("lists registered customers with no GSTIN, lines with no HSN/SAC and invoices with no place of supply, each with a link to fix it", async () => {
    await issue("harbourInvoice", ids.harbour!, [{ name: "Bar counter", quantity: 1, unitPriceAmount: "1000000", taxGroupId: gst18, hsnSac: "9403" }]);
    // The GSTIN was taken off the contact after the invoice went out.
    await db.update(contacts).set({ taxId: null }).where(eq(contacts.id, ids.harbour!));
    await issue("noHsn", ids.anita!, [
      { name: "Shoe rack", quantity: 1, unitPriceAmount: "500000", taxGroupId: gst18 },
      { name: "Fitting", quantity: 1, unitPriceAmount: "100000", taxGroupId: gst18 },
    ]);
    await issue("noPos", ids.anita!, [{ name: "Shelf", quantity: 1, unitPriceAmount: "200000", taxGroupId: gst18, hsnSac: "9403" }]);
    await db.update(invoices).set({ placeOfSupply: null }).where(eq(invoices.id, ids.noPos!));

    const s = await summary();
    expect(s.problems).toEqual([
      { kind: "missing_gstin", recordId: ids.harbour, label: "Registered customer with no GSTIN — Harbour Café LLP", href: `/contacts/${ids.harbour}`, action: "Open contact" },
      { kind: "missing_hsn", recordId: ids.noHsn, label: `2 lines with no HSN/SAC — ${numbers.noHsn}`, href: `/invoices/${ids.noHsn}`, action: "Open invoice" },
      { kind: "missing_place_of_supply", recordId: ids.noPos, label: `No place of supply — ${numbers.noPos}`, href: `/invoices/${ids.noPos}`, action: "Open invoice" },
    ]);
    expect(s.totalsMatchTaxSummary).toBe(true);
  });

  it("flags totals that don't match the Tax Summary", async () => {
    // Output tax in the ledger with no document behind it.
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    await db.transaction((tx) =>
      testApp.app.get(LedgerService).postEntry(tx, {
        orgId,
        date: today,
        narration: "Imported sale",
        sourceType: "test_sale",
        sourceId: randomUUID(),
        lines: [
          { accountId: code["1100"]!, debit: 11800n, credit: 0n },
          { accountId: code["4000"]!, debit: 0n, credit: 10000n },
          { accountId: code["2100"]!, debit: 0n, credit: 1800n },
        ],
      }),
    );
    const s = await summary();
    expect(s.totalsMatchTaxSummary).toBe(false);
    expect(BigInt(s.taxSummaryTax) - BigInt(s.totals.tax)).toBe(1800n);
    const mismatch = s.problems.find((p) => p.kind === "totals_mismatch")!;
    expect(mismatch.label).toMatch(/^Tax in the file \(₹[\d,.]+\) doesn't match tax collected on the Tax Summary \(₹[\d,.]+\)/);
    expect(mismatch.href).toBe(`/reports/tax-summary?from=${month}-01&to=${month}-${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()}`);
  });

  it("Excel has one sheet per table plus Problems, with the same figures as the JSON; the download is audited", async () => {
    const res = await call("GET", `/exports/gstr1?period=${month}&format=xlsx`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(`GSTR1_${KA_GSTIN}_${month.slice(5, 7)}${month.slice(0, 4)}.xlsx`);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await res.arrayBuffer()) as unknown as ArrayBuffer);
    expect(book.worksheets.map((w) => w.name)).toEqual(["b2b", "b2cl", "b2cs", "cdnr", "cdnur", "exp", "exemp", "hsn(b2b)", "hsn(b2c)", "docs", "Problems"]);

    const file = await json<{ b2b: { inv: { itms: { itm_det: { txval: number; camt: number } }[] }[] }[]; b2cs: { txval: number }[]; doc_issue: { doc_det: { docs: { totnum: number }[] }[] } }>(
      await call("GET", `/exports/gstr1?period=${month}&format=json`),
    );
    const column = (sheet: string, header: string) => {
      const ws = book.getWorksheet(sheet)!;
      const index = (ws.getRow(1).values as unknown[]).indexOf(header);
      return ws.getSheetValues().slice(2).map((row) => Number((row as unknown[])[index]));
    };
    const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
    expect(sum(column("b2b", "Taxable value"))).toBe(sum(file.b2b.flatMap((r) => r.inv.flatMap((i) => i.itms.map((x) => x.itm_det.txval)))));
    expect(sum(column("b2b", "Central tax"))).toBe(sum(file.b2b.flatMap((r) => r.inv.flatMap((i) => i.itms.map((x) => x.itm_det.camt)))));
    expect(sum(column("b2cs", "Taxable value"))).toBe(sum(file.b2cs.map((r) => r.txval)));
    expect(column("docs", "Total number")[0]).toBe(file.doc_issue.doc_det[0]!.docs[0]!.totnum);
    const problems = book.getWorksheet("Problems")!.getColumn(1).values.map(String);
    expect(problems).toContain("Registered customer with no GSTIN — Harbour Café LLP");
    expect(problems).toContain("Spine prepares this file; it doesn't file your return. Check it, then upload it on the GST portal.");

    const audited = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "gstr1_export")));
    expect(audited.map((a) => (a.changes as { format: string }).format).sort()).toEqual(["Excel", "JSON"]);
    expect(audited.every((a) => a.actorUserId === ownerId)).toBe(true);
  });
});
