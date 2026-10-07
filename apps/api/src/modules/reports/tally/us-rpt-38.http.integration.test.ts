import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MoneyAccount, TallyMappingRow } from "@spine/shared";
import { createDb, type Database } from "../../../db/client";
import { accounts, auditLog, expenseCategories, member, session as sessionTable } from "../../../db/schema";
import { createTestApp, signUp, type TestApp } from "../../../test-utils/test-app";

type Who = { cookie: string; userId: string };
const DATE = "2026-09-10";
// Credit notes are dated the day they're issued, so the range runs to today.
const TO = new Date().toISOString().slice(0, 10);

/** US-RPT-38 — the books as a Tally ZIP: masters, vouchers and a README. Requires local Postgres. */
describe("US-RPT-38 · export my books for Tally (requires local Postgres)", () => {
  let testApp: TestApp;
  let db: Database;
  let orgId: string;
  const owner: Who = { cookie: "", userId: "" };
  const field: Who = { cookie: "", userId: "" };
  const numbers: Record<string, string> = {};
  let files: Record<string, string>;

  const call = (who: Who, method: string, path: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}${path}`, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), cookie: who.cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async <T>(res: Response) => {
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    return (await res.json()) as T;
  };
  const post = <T>(path: string, body?: unknown) => call(owner, "POST", path, body ?? {}).then((r) => json<T>(r));
  /** Every VOUCHER element, with its type and the AMOUNTs of its ledger entries. */
  const vouchers = () =>
    [...files["vouchers.xml"]!.matchAll(/<VOUCHER [^>]*VCHTYPE="([^"]+)"[\s\S]*?<\/VOUCHER>/g)].map((m) => ({
      type: m[1]!,
      xml: m[0],
      amounts: [...m[0].matchAll(/<ISPARTYLEDGER>\w+<\/ISPARTYLEDGER>\s*<AMOUNT>(-?[\d.]+)<\/AMOUNT>/g)].map((a) => Number(a[1])),
    }));
  const voucherFor = (number: string) => vouchers().find((v) => v.xml.includes(`<VOUCHERNUMBER>${number}</VOUCHERNUMBER>`))!;

  beforeAll(async () => {
    testApp = await createTestApp();
    db = createDb(process.env.DATABASE_URL ?? "postgres://spine:spine@localhost:5432/spine");
    for (const [who, name] of [[owner, "owner"], [field, "field"]] as const) {
      Object.assign(who, await signUp(testApp.baseUrl, { email: `us-rpt-38-${name}-${randomUUID()}@example.com`, password: "testpassword123", name }));
    }
    orgId = (await db.select().from(member).where(eq(member.userId, owner.userId)))[0]!.organizationId;
    await db.delete(member).where(eq(member.userId, field.userId));
    await db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: field.userId, role: "field", createdAt: new Date() });
    await db.update(sessionTable).set({ activeOrganizationId: orgId }).where(eq(sessionTable.userId, field.userId));

    await json(await call(owner, "PUT", "/org/settings/business_profile", { value: { name: "Kaveri Interiors" } }));
    await json(await call(owner, "PUT", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } }));
    await json(await call(owner, "PUT", "/org/tax/profile", { country: "IN" }));
    await json(await call(owner, "PUT", "/org/tax/profile", { registrationNumber: "29AAACK0000A1ZK", stateCode: "29", legalName: "Kaveri Interiors Private Limited" }));
    const gst18 = (await json<{ id: string; name: string }[]>(await call(owner, "GET", "/tax-groups"))).find((g) => g.name === "GST 18%")!.id;
    const code = Object.fromEntries((await db.select().from(accounts).where(eq(accounts.orgId, orgId))).map((a) => [a.code, a.id]));
    const bank = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.code === "1010")!;
    const cash = (await json<MoneyAccount[]>(await call(owner, "GET", "/money-accounts"))).find((a) => a.kind === "cash")!;

    // Rent moves to Direct Expenses before the export; it must land there.
    const mapping = await json<TallyMappingRow[]>(await call(owner, "GET", "/exports/tally/mapping"));
    await json(await call(owner, "PUT", "/exports/tally/mapping", { mappings: [{ accountId: mapping.find((m) => m.code === "6000")!.accountId, tallyGroup: "Direct Expenses" }] }));

    const customer = (
      await post<{ id: string }>("/contacts", {
        type: "customer",
        isCompany: true,
        name: "Lakeview Homes LLP",
        gstTreatment: "registered",
        taxId: "29AABFL0000B1ZA",
        addresses: [{ type: "billing", line1: "8 Indiranagar 2nd Stage", city: "Bengaluru", postalCode: "560038", stateCode: "29", isPrimary: true }],
      })
    ).id;
    const vendor = (await post<{ id: string }>("/contacts", { type: "vendor", isCompany: true, name: "Shree Cement Traders", gstTreatment: "unregistered", addresses: [{ type: "billing", line1: "Peenya", stateCode: "29", isPrimary: true }] })).id;

    const draft = await post<{ id: string }>("/invoices", { contactId: customer, currency: "INR", issueDate: DATE, lines: [{ name: "Modular kitchen", quantity: 1, unitPriceAmount: "10000000", taxGroupId: gst18, hsnSac: "9403" }] });
    const invoice = await post<{ id: string; number: string }>(`/invoices/${draft.id}/issue`);
    numbers.invoice = invoice.number;
    numbers.payment = (await post<{ number: string }>("/payments", { contactId: customer, date: DATE, method: "bank_transfer", currency: "INR", amount: "5000000", moneyAccountId: bank.id, allocations: [{ invoiceId: invoice.id, amount: "5000000" }] })).number;
    const credit = await post<{ id: string }>("/credit-notes", { invoiceId: invoice.id, lines: [{ name: "Two doors returned", quantity: 1, unitPriceAmount: "1000000", taxRatePercentage: 18 }] });
    numbers.credit = (await post<{ number: string }>(`/credit-notes/${credit.id}/issue`)).number;

    const bill = await post<{ id: string }>("/vendor-bills", { contactId: vendor, billNumber: "SCT-881", date: DATE, currency: "INR", lines: [{ type: "item", name: "Cement", quantity: 1, unitPriceAmount: "5000000", taxGroupId: gst18 }] });
    await post(`/vendor-bills/${bill.id}/record`);
    numbers.vendorPayment = (await post<{ number: string }>("/vendor-payments", { contactId: vendor, date: DATE, method: "bank_transfer", currency: "INR", amount: "2000000", moneyAccountId: bank.id, allocations: [{ billId: bill.id, amount: "2000000" }] })).number;
    const vendorCredit = await post<{ id: string }>("/vendor-credits", { contactId: vendor, billId: bill.id, vendorReference: "SCT-CN-12", date: DATE, currency: "INR", lines: [{ type: "item", name: "Damaged bags", quantity: 1, unitPriceAmount: "100000" }] });
    numbers.vendorCredit = (await post<{ number: string }>(`/vendor-credits/${vendorCredit.id}/record`)).number;

    await post("/bank-transfers", { fromMoneyAccountId: bank.id, toMoneyAccountId: cash.id, amount: "100000", date: DATE });
    const [category] = await db.insert(expenseCategories).values({ orgId, name: "Site rent", accountId: code["6000"]! }).returning();
    const expense = await post<{ id: string }>("/expenses", { categoryId: category!.id, date: DATE, currency: "INR", amount: "300000", moneyAccountId: bank.id });
    numbers.expense = (await post<{ number: string }>(`/expenses/${expense.id}/approve`, {})).number;
    numbers.journal = (await post<{ number: string }>("/manual-journals", { date: DATE, reason: "Depreciation", lines: [{ accountId: code["6500"], debit: "50000", credit: "0" }, { accountId: code["1510"], debit: "0", credit: "50000" }] })).number;

    const res = await call(owner, "GET", `/exports/tally?from=2026-09-01&to=${TO}`);
    expect(res.status, await res.clone().text()).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/zip");
    expect(res.headers.get("content-disposition")).toContain(`tally-2026-09-01-${TO}.zip`);
    const unzipped = unzipSync(new Uint8Array(await res.arrayBuffer()));
    files = Object.fromEntries(Object.entries(unzipped).map(([name, bytes]) => [name, strFromU8(bytes)]));
  }, 120_000);

  afterAll(async () => {
    await testApp?.close();
  });

  it("the ZIP holds masters.xml, vouchers.xml and a README on how to import them", () => {
    expect(Object.keys(files).sort()).toEqual(["README.txt", "masters.xml", "vouchers.xml"]);
    expect(files["README.txt"]).toContain("Gateway of Tally > Import > Masters");
    expect(files["README.txt"]).toContain("Gateway of Tally > Import > Transactions");
  });

  it("masters: accounts used under their mapped group; customers under Sundry Debtors and vendors under Sundry Creditors with address, state and GSTIN", () => {
    const masters = files["masters.xml"]!;
    const parentOf = (name: string) => new RegExp(`<NAME>${name}</NAME></NAME.LIST>\\s*<PARENT>([^<]+)</PARENT>`).exec(masters)?.[1];
    expect(parentOf("Bank Account")).toBe("Bank Accounts");
    expect(parentOf("Output Tax Payable")).toBe("Duties &amp; Taxes");
    expect(parentOf("Rent")).toBe("Direct Expenses");
    expect(parentOf("Lakeview Homes LLP")).toBe("Sundry Debtors");
    expect(parentOf("Shree Cement Traders")).toBe("Sundry Creditors");
    expect(masters).toContain("<PARTYGSTIN>29AABFL0000B1ZA</PARTYGSTIN>");
    expect(masters).toContain("<LEDSTATENAME>Karnataka</LEDSTATENAME>");
    expect(masters).toContain("<ADDRESS>8 Indiranagar 2nd Stage</ADDRESS>");
    // Customers and vendors replace Accounts Receivable and Payable.
    expect(parentOf("Accounts Receivable")).toBeUndefined();
    expect(parentOf("Accounts Payable")).toBeUndefined();
  });

  it("vouchers: each document as its Tally type, balanced, with bill-wise references", () => {
    expect(voucherFor(numbers.invoice!).type).toBe("Sales");
    expect(voucherFor(numbers.invoice!).xml).toMatch(new RegExp(`<NAME>${numbers.invoice}</NAME>\\s*<BILLTYPE>New Ref</BILLTYPE>`));
    expect(voucherFor(numbers.payment!).type).toBe("Receipt");
    expect(voucherFor(numbers.payment!).xml).toMatch(new RegExp(`<NAME>${numbers.invoice}</NAME>\\s*<BILLTYPE>Agst Ref</BILLTYPE>`));
    expect(voucherFor(numbers.credit!).type).toBe("Credit Note");
    expect(voucherFor(numbers.credit!).xml).toMatch(new RegExp(`<NAME>${numbers.invoice}</NAME>\\s*<BILLTYPE>Agst Ref</BILLTYPE>`));
    expect(voucherFor("SCT-881").type).toBe("Purchase");
    expect(voucherFor("SCT-881").xml).toMatch(/<NAME>SCT-881<\/NAME>\s*<BILLTYPE>New Ref<\/BILLTYPE>/);
    expect(voucherFor(numbers.vendorPayment!).type).toBe("Payment");
    expect(voucherFor(numbers.vendorPayment!).xml).toMatch(/<NAME>SCT-881<\/NAME>\s*<BILLTYPE>Agst Ref<\/BILLTYPE>/);
    expect(voucherFor(numbers.vendorCredit!).type).toBe("Debit Note");
    expect(voucherFor(numbers.expense!).type).toBe("Payment");
    expect(voucherFor(numbers.journal!).type).toBe("Journal");
    expect(vouchers().filter((v) => v.type === "Contra")).toHaveLength(1);
    for (const v of vouchers()) expect(Math.round(v.amounts.reduce((s, a) => s + a, 0) * 100), v.xml.slice(0, 200)).toBe(0);
  });

  it("the page's summary counts ledgers and vouchers by type, and lists accounts on default groups", async () => {
    const summary = await json<{ ledgers: number; vouchers: number; byType: { voucherType: string; label: string; count: number }[]; defaults: { code: string }[] }>(
      await call(owner, "GET", `/exports/tally?from=2026-09-01&to=${TO}&format=summary`),
    );
    expect(summary.vouchers).toBe(vouchers().length);
    expect(summary.ledgers).toBe((files["masters.xml"]!.match(/<LEDGER /g) ?? []).length);
    expect(summary.byType.find((t) => t.voucherType === "Sales")).toEqual({ voucherType: "Sales", label: "Invoices", count: 1 });
    expect(summary.byType.find((t) => t.voucherType === "Contra")!.count).toBe(1);
    // Rent was mapped by hand; the rest used are on defaults, and the README says which.
    expect(summary.defaults.map((d) => d.code)).not.toContain("6000");
    expect(summary.defaults.some((d) => d.code.startsWith("4"))).toBe(true);
    expect(files["README.txt"]).toContain("ACCOUNTS ON SPINE'S DEFAULT GROUP");
    expect(files["README.txt"]).toMatch(/4\d00 Sales .* -> Sales Accounts/);
  });

  it("the download is audited; a bad range is refused; Field can't export", async () => {
    const audited = await db.select().from(auditLog).where(and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, "tally_export")));
    expect(audited).toHaveLength(1);
    expect(audited[0]).toMatchObject({ action: "downloaded", actorUserId: owner.userId });
    const bad = await call(owner, "GET", "/exports/tally?from=2026-09-30&to=2026-09-01");
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toBe("Choose a From date on or before the To date.");
    expect((await call(field, "GET", `/exports/tally?from=2026-09-01&to=${TO}`)).status).toBe(403);
  });
});
