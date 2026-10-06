import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount } from "@spine/shared";
import { createDb, type Database } from "../../db/client";
import { accounts, contacts, member, user } from "../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../test-utils/test-app";

type Who = { cookie: string; userId: string };

/** US-RPT-32 (D-144) — every report as CSV or Excel, holding exactly what the page shows. Requires local Postgres. */
describe("US-RPT-32 · export every report to CSV and Excel (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  const emails: string[] = [];
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const range = "from=2026-07-01&to=2026-09-30";

  const get = (path: string) => fetch(`${testApp.baseUrl}${path}`, { headers: { cookie: owner.cookie } });
  const call = (method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: owner.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const csv = async (path: string) => {
    const res = await get(path);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    return { disposition: res.headers.get("content-disposition"), lines: (await res.text()).split(/\r?\n/) };
  };
  const workbook = async (path: string) => {
    const res = await get(path);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(res.headers.get("content-type")).toContain("spreadsheetml");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await res.arrayBuffer()) as unknown as ExcelJS.Buffer);
    return { sheet: book.worksheets[0]!, disposition: res.headers.get("content-disposition") };
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    const email = `us-rpt-32-owner-${randomUUID()}@example.com`;
    emails.push(email);
    Object.assign(owner, await signUp(testApp.baseUrl, { email, password: "testpassword123", name: "owner" }));
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await json(await call("PUT", "/org/settings/business_profile", { value: { name: "Riverstone Builders" } }));
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const bank = (await json<MoneyAccount[]>(await call("GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    for (const [direction, accountCode, amount, date] of [
      ["in", "4100", "1234550", "2026-08-10"],
      ["in", "4100", "300000", "2026-05-10"],
      ["out", "6000", "720000", "2026-09-05"],
    ] as const) {
      await json(await call("POST", "/bank-transactions", { moneyAccountId: bank.id, direction, accountId: code[accountCode], amount, date }));
    }
    const [maple] = await db.insert(contacts).values({ orgId, type: "customer", name: "Maple Ridge Developments", createdByUserId: owner.userId }).returning();
    const [blue] = await db.insert(contacts).values({ orgId, type: "customer", name: "Bluewater Hospitality Group", createdByUserId: owner.userId }).returning();
    await json(await call("POST", "/payments", { contactId: maple!.id, date: "2026-09-02", method: "bank_transfer", currency: "USD", amount: "500000", moneyAccountId: bank.id }));
    await json(await call("POST", "/payments", { contactId: blue!.id, date: "2026-09-03", method: "cheque", currency: "USD", amount: "70000", moneyAccountId: bank.id }));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
    await db.delete(user).where(inArray(user.email, emails));
  });

  it("CSV: plain decimal amounts with the currency in its own column, named <report>-<from>-<to>", async () => {
    const { disposition, lines } = await csv(`/reports/profit-and-loss?${range}&format=csv`);
    expect(disposition).toBe('attachment; filename="profit-and-loss-2026-07-01-2026-09-30.csv"');
    expect(lines[0]).toBe("Account,Amount,Currency");
    expect(lines).toContain("4100 · Sales — Services,12345.50,USD");
    expect(lines).toContain("Net profit,5145.50,USD");
  });

  it("Excel: business name, report name and range first; bold headings; frozen heading row; amounts are numbers with two decimals", async () => {
    const { sheet, disposition } = await workbook(`/reports/profit-and-loss?${range}&format=xlsx`);
    expect(disposition).toBe('attachment; filename="profit-and-loss-2026-07-01-2026-09-30.xlsx"');
    expect([sheet.getCell("A1").value, sheet.getCell("A2").value, sheet.getCell("A3").value]).toEqual(["Riverstone Builders", "Profit & Loss", "Jul – Sep 2026 · Accrual basis"]);
    const headerRow = sheet.getRow(6);
    expect([headerRow.getCell(1).value, headerRow.getCell(2).value]).toEqual(["Account", "Amount"]);
    expect(headerRow.font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 6 });
    let sales: ExcelJS.Row | undefined;
    sheet.eachRow((row) => {
      if (row.getCell(1).value === "4100 · Sales — Services") sales = row;
    });
    expect(sales!.getCell(2).value).toBe(12345.5);
    expect(typeof sales!.getCell(2).value).toBe("number");
    expect(sales!.getCell(2).numFmt).toContain("0.00");
  });

  it("comparison columns and filters are exported as on screen", async () => {
    const { lines } = await csv(`/reports/profit-and-loss?${range}&compare=previous&format=csv`);
    expect(lines[0]).toBe("Account,Jul – Sep 2026,Apr – Jun 2026,Change,Change %,Currency");
    expect(lines).toContain("4100 · Sales — Services,12345.50,3000.00,9345.50,311.5,USD");
    const searched = await csv(`/reports/payments-received?${range}&search=bluewater&format=csv`);
    expect(searched.lines.filter((l) => l.includes("Hospitality"))).toHaveLength(1);
    expect(searched.lines.some((l) => l.includes("Maple Ridge"))).toBe(false);
  });

  it("the Tax Summary, journals, the general ledger and the registers export too", async () => {
    expect((await workbook(`/org/tax/summary?${range}&format=xlsx`)).sheet.getCell("A2").value).toBe("Tax Summary");
    expect((await csv("/manual-journals?format=csv")).lines[0]).toBe("Number,Date,Reason,Status,Total,Posted by,Currency");
    const gl = await csv(`/reports/general-ledger?${range}&format=csv`);
    // 1010, 2200 (the unallocated payments), 4100 and 6000 — every account, not one page.
    expect(gl.lines.filter((l) => l.startsWith(",Closing balance"))).toHaveLength(4);
    for (const path of ["cash-flow", "day-book", "sales-by-customer", "sales-by-item", "expenses-by-category", "purchases-by-vendor", "payments-made", "customer-credits", "vendor-credits"]) {
      const res = await get(`/reports/${path}?${range}&format=xlsx`);
      expect(res.status, path).toBe(200);
    }
    for (const path of ["/reports/trial-balance?asOf=2026-09-30", "/reports/balance-sheet?asOf=2026-09-30&compareAsOf=2025-12-31", "/reports/receivables?", "/reports/payables?", "/reports/job-profitability?status=all"]) {
      const res = await get(`${path}&format=csv`);
      expect(res.status, path).toBe(200);
    }
  });

  it("the old /export.csv routes still work; an unknown format is refused", async () => {
    expect((await csv("/reports/trial-balance/export.csv?asOf=2026-09-30")).lines[0]).toBe("Code,Account,Debit,Credit");
    const bad = await get(`/reports/profit-and-loss?${range}&format=docx`);
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toBe("Choose CSV, Excel or PDF.");
  });
});
