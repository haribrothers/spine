import { randomUUID } from "node:crypto";
import { and, eq, gte, lte, notInArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, expenseCategories, journalEntries, journalLines, member } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";
import { TAX_SETTLEMENT_SOURCES } from "../tax/tax-payments.service";
import type { TaxSummaryReport } from "./reports.service";

const KA_GSTIN = "29AAACK0000A1ZK";

/**
 * US-RPT-37 — the Tax Summary by rate on both sides, by tax type and by
 * supply class, with tax payments, tied to the ledger. Requires local Postgres.
 */
describe("US-RPT-37 · see tax collected and paid by rate and tax type (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  let cookie = "";
  let report: TaxSummaryReport;
  const from = "2026-07-01";
  // Credit notes are dated when they're issued, so the range runs to today.
  const to = new Date().toISOString().slice(0, 10);

  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  /** Net of credits less debits (or debits less credits) on a tax account, leaving out settlements — read straight from the ledger. */
  const ledgerNet = async (code: string, side: "credit" | "debit") => {
    const rows = await db
      .select({ debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(
        and(
          eq(journalEntries.orgId, orgId),
          eq(accounts.code, code),
          gte(journalEntries.date, from),
          lte(journalEntries.date, to),
          notInArray(journalEntries.sourceType, [...TAX_SETTLEMENT_SOURCES]),
        ),
      );
    return rows.reduce((sum, r) => sum + (side === "credit" ? r.credit - r.debit : r.debit - r.credit), 0n);
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const owner = await signUp(testApp.baseUrl, { email: `us-rpt-37-${randomUUID()}@example.com`, password: "testpassword123", name: "Owner" });
    cookie = owner.cookie;
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await json(await call("PUT", "/org/settings/business_profile", { value: { name: "Kaveri Interiors" } }));
    await json(await call("PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } }));
    await json(await call("PUT", "/org/tax/profile", { country: "IN" }));
    await json(await call("PUT", "/org/tax/profile", { registrationNumber: KA_GSTIN, stateCode: "29", legalName: "Kaveri Interiors Private Limited" }));
    const gst18 = (await json<{ id: string; name: string }[]>(await call("GET", "/tax-groups"))).find((g) => g.name === "GST 18%")!.id;
    const igst18 = (await json<{ id: string; name: string }[]>(await call("GET", "/tax-rates"))).find((r) => r.name === "IGST 18%")!.id;
    const contact = async (body: Record<string, unknown>) => (await json<{ id: string }>(await call("POST", "/contacts", { isCompany: true, ...body }))).id;
    const local = await contact({ type: "customer", name: "Lakeview Homes LLP", gstTreatment: "registered", taxId: KA_GSTIN, addresses: [{ type: "billing", line1: "8 Indiranagar", stateCode: "29", isPrimary: true }] });
    const mumbai = await contact({ type: "customer", name: "Harbour Café LLP", gstTreatment: "registered", taxId: "27AAPFU0939F1ZV", addresses: [{ type: "billing", line1: "Marine Drive", stateCode: "27", isPrimary: true }] });
    const vendor = await contact({ type: "vendor", name: "Shree Cement Traders", gstTreatment: "registered", taxId: KA_GSTIN, addresses: [{ type: "billing", line1: "Peenya", stateCode: "29", isPrimary: true }] });

    // Sales: ₹1,80,000 at GST 18% and ₹10,000 exempt within Karnataka; ₹1,00,000 at IGST 18% and ₹5,000 zero-rated to Mumbai.
    const issue = async (body: Record<string, unknown>) => {
      const draft = await json<{ id: string }>(await call("POST", "/invoices", { currency: "INR", ...body }));
      await json(await call("POST", `/invoices/${draft.id}/issue`));
      return draft.id;
    };
    const invoiceA = await issue({
      contactId: local,
      issueDate: "2026-08-10",
      lines: [
        { name: "Modular kitchen", quantity: 1, unitPriceAmount: "18000000", taxGroupId: gst18 },
        { name: "Design consultation", quantity: 1, unitPriceAmount: "1000000", supplyClass: "exempt" },
      ],
    });
    await issue({
      contactId: mumbai,
      issueDate: "2026-08-20",
      lines: [
        { name: "Wardrobes", quantity: 1, unitPriceAmount: "10000000", taxRateId: igst18 },
        { name: "Export packing", quantity: 1, unitPriceAmount: "500000", supplyClass: "zero_rated" },
      ],
    });
    // A ₹10,000 credit at 18% on the first invoice.
    const credit = await json<{ id: string }>(await call("POST", "/credit-notes", { invoiceId: invoiceA, lines: [{ name: "Two doors returned", quantity: 1, unitPriceAmount: "1000000", taxRatePercentage: 18 }] }));
    await json(await call("POST", `/credit-notes/${credit.id}/issue`));

    // Purchases: a bill (₹50,000 at GST 18%, ₹12,000 exempt, ₹8,400 non-taxable), a ₹5,000 vendor credit at GST 18%,
    // an expense with ₹1,800 IGST and money out with GST 18% on ₹5,000.
    const bill = await json<{ id: string }>(
      await call("POST", "/vendor-bills", {
        contactId: vendor,
        billNumber: "SCT-881",
        date: "2026-08-05",
        currency: "INR",
        lines: [
          { type: "item", name: "Cement", quantity: 1, unitPriceAmount: "5000000", taxGroupId: gst18 },
          { type: "item", name: "River sand", quantity: 1, unitPriceAmount: "1200000", supplyClass: "exempt" },
          { type: "item", name: "Toll charges", quantity: 1, unitPriceAmount: "840000", supplyClass: "non_taxable" },
        ],
      }),
    );
    await json(await call("POST", `/vendor-bills/${bill.id}/record`));
    const vendorCredit = await json<{ id: string }>(
      await call("POST", "/vendor-credits", { contactId: vendor, vendorReference: "SCT-CN-12", date: "2026-08-25", currency: "INR", lines: [{ type: "item", name: "Damaged bags", quantity: 1, unitPriceAmount: "500000", taxGroupId: gst18 }] }),
    );
    await json(await call("POST", `/vendor-credits/${vendorCredit.id}/record`));
    const bank = (await json<MoneyAccount[]>(await call("GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const [other] = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.code, "6900")));
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Freight", accountId: other!.id }).returning();
    const expense = await json<{ id: string }>(
      await call("POST", "/expenses", { categoryId: category!.id, date: "2026-08-12", currency: "INR", amount: "1180000", taxAmount: "180000", taxRateId: igst18, moneyAccountId: bank.id }),
    );
    await json(await call("POST", `/expenses/${expense.id}/approve`, {}));
    await json(await call("POST", "/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: other!.id, amount: "590000", taxGroupId: gst18, date: "2026-08-15" }));

    // ₹10,000 paid to the tax authority for Q3.
    await json(await call("POST", "/tax-payments", { periodFrom: "2026-07-01", periodTo: "2026-09-30", inputTaxUsed: "0", amount: "1000000", moneyAccountId: bank.id, date: "2026-10-01" }));

    report = await json<TaxSummaryReport>(await call("GET", `/org/tax/summary?from=${from}&to=${to}`));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("'Collected by rate' is joined by 'Paid by rate' — bills, expenses and money out, less vendor credits", () => {
    expect(report.collectedByRate).toEqual([
      { name: "GST 18%", percentage: 18, taxableAmount: "18000000", amount: "3240000" },
      { name: "IGST 18%", percentage: 18, taxableAmount: "10000000", amount: "1800000" },
    ]);
    expect(report.adjustments).toEqual({ taxableAmount: "-1000000", amount: "-180000" });
    // GST 18%: ₹9,000 on the bill − ₹900 on the vendor credit + ₹900 on money out; IGST 18%: ₹1,800 on the expense.
    expect(report.paidByRate).toEqual([
      { name: "GST 18%", percentage: 18, taxableAmount: "5000000", amount: "900000" },
      { name: "IGST 18%", percentage: 18, taxableAmount: "1000000", amount: "180000" },
    ]);
    expect(report.paidAdjustments).toBeNull();
    expect(report.totalPaidTaxable).toBe("6000000");
  });

  it("'By tax type' shows CGST, SGST, IGST and cess collected, paid and net", () => {
    expect(report.byTaxType.rows).toEqual([
      { taxType: "cgst", label: "CGST", collected: "1530000", paid: "450000", net: "1080000" },
      { taxType: "sgst", label: "SGST", collected: "1530000", paid: "450000", net: "1080000" },
      { taxType: "igst", label: "IGST", collected: "1800000", paid: "180000", net: "1620000" },
      { taxType: "cess", label: "Cess", collected: "0", paid: "0", net: "0" },
    ]);
    expect(report.byTaxType.total).toEqual({ collected: "4860000", paid: "1080000", net: "3780000" });
  });

  it("lists zero-rated, exempt and non-taxable sales and purchases", () => {
    expect(report.bySupplyClass).toEqual([
      { supplyClass: "zero_rated", label: "Zero-rated", sales: "500000", purchases: "0" },
      { supplyClass: "exempt", label: "Exempt", sales: "1000000", purchases: "1200000" },
      { supplyClass: "non_taxable", label: "Non-taxable", sales: "0", purchases: "840000" },
    ]);
  });

  it("shows what was paid to the tax authority and what's still to pay below net payable", () => {
    expect(report.netTaxPayable).toBe("3780000");
    expect(report.payments).toEqual({ paid: "1000000", refunded: "0", stillToPay: "2780000" });
  });

  it("total collected equals 2100's credits and total paid equals 1200's debits for the range", async () => {
    const collected = await ledgerNet("2100", "credit");
    const paid = await ledgerNet("1200", "debit");
    expect(collected).toBe(4860000n);
    expect(paid).toBe(1080000n);
    expect(report.taxCollected).toBe(collected.toString());
    expect(report.taxPaid).toBe(paid.toString());
    const sum = (rows: { amount: string }[]) => rows.reduce((s, r) => s + BigInt(r.amount), 0n);
    expect(sum(report.collectedByRate) + BigInt(report.adjustments?.amount ?? "0")).toBe(collected);
    expect(sum(report.paidByRate) + BigInt(report.paidAdjustments?.amount ?? "0")).toBe(paid);
    expect(report.byTaxType.rows.reduce((s, r) => s + BigInt(r.collected), 0n)).toBe(collected);
    expect(report.byTaxType.rows.reduce((s, r) => s + BigInt(r.paid), 0n)).toBe(paid);
  });

  it("the export carries the new tables", async () => {
    const res = await call("GET", `/org/tax/summary?from=${from}&to=${to}&format=csv`);
    expect(res.status).toBe(200);
    const csv = await res.text();
    for (const text of ["Paid by rate", "Paid to the tax authority", "Still to pay", "CGST collected", "IGST net", "Exempt purchases"]) expect(csv).toContain(text);
  });
});
