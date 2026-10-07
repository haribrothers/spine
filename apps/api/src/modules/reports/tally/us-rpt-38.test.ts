import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mastersXml, readmeText, tallyAmount, vouchersXml, xmlText, type TallyLedger, type TallyVoucher } from "./tally-xml";

/** Sample files for a Tally import check, kept in the repo; `UPDATE_TALLY_SAMPLES=1` rewrites them. */
const SAMPLES = join(__dirname, "../../../../../../docs/samples/tally");

const ledgers: TallyLedger[] = [
  { name: "HDFC Current", parent: "Bank Accounts" },
  { name: "Output Tax Payable", parent: "Duties & Taxes" },
  { name: "Sales — Services", parent: "Sales Accounts" },
  { name: "Cost of Materials", parent: "Direct Expenses" },
  { name: "Input Tax Receivable", parent: "Duties & Taxes" },
  {
    name: "Lakeview Homes LLP",
    parent: "Sundry Debtors",
    party: { address: ["8 Indiranagar 2nd Stage", "Bengaluru 560038"], state: "Karnataka", country: "India", gstin: "29AABFL0000B1ZA", registrationType: "Regular" },
  },
  { name: "Shree Cement Traders", parent: "Sundry Creditors", party: { address: ["Peenya Industrial Area"], state: "Karnataka", country: "India", gstin: null, registrationType: "Unregistered" } },
];

const vouchers: TallyVoucher[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    type: "Sales",
    date: "2026-09-10",
    number: "INV-0001",
    narration: "Invoice INV-0001 issued",
    partyLedger: "Lakeview Homes LLP",
    entries: [
      { ledger: "Lakeview Homes LLP", amount: 11800000n, bills: [{ name: "INV-0001", type: "New Ref", amount: 11800000n }] },
      { ledger: "Sales — Services", amount: -10000000n },
      { ledger: "Output Tax Payable", amount: -1800000n },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    type: "Receipt",
    date: "2026-09-20",
    number: "RCP-0001",
    narration: "Payment RCP-0001 recorded",
    partyLedger: "Lakeview Homes LLP",
    entries: [
      { ledger: "HDFC Current", amount: 5000000n },
      { ledger: "Lakeview Homes LLP", amount: -5000000n, bills: [{ name: "INV-0001", type: "Agst Ref", amount: -5000000n }] },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    type: "Purchase",
    date: "2026-09-05",
    number: "SCT-881",
    narration: "Bill SCT-881 recorded",
    partyLedger: "Shree Cement Traders",
    entries: [
      { ledger: "Cost of Materials", amount: 5000000n },
      { ledger: "Input Tax Receivable", amount: 900000n },
      { ledger: "Shree Cement Traders", amount: -5900000n, bills: [{ name: "SCT-881", type: "New Ref", amount: -5900000n }] },
    ],
  },
];

const readme = () =>
  readmeText({
    business: "Kaveri Interiors",
    from: "2026-09-01",
    to: "2026-09-30",
    ledgers: ledgers.length,
    counts: [
      { type: "Sales", count: 1 },
      { type: "Receipt", count: 1 },
      { type: "Purchase", count: 1 },
    ],
    defaults: [{ code: "5000", name: "Cost of Materials", group: "Direct Expenses" }],
  });

/** The AMOUNT values directly inside each voucher's ledger entries. */
const voucherAmounts = (xml: string) =>
  [...xml.matchAll(/<VOUCHER [\s\S]*?<\/VOUCHER>/g)].map((m) => [...m[0].matchAll(/<ALLLEDGERENTRIES\.LIST>\s*<LEDGERNAME>[^<]*<\/LEDGERNAME>\s*<ISDEEMEDPOSITIVE>(Yes|No)<\/ISDEEMEDPOSITIVE>\s*<ISPARTYLEDGER>\w+<\/ISPARTYLEDGER>\s*<AMOUNT>(-?[\d.]+)<\/AMOUNT>/g)].map((a) => ({ deemedPositive: a[1] === "Yes", amount: Number(a[2]) })));

describe("US-RPT-38", () => {
  it("escapes XML and writes anything beyond ASCII as a character reference", () => {
    expect(xmlText(`Sales — Services & "Co" <1>`)).toBe("Sales &#8212; Services &amp; &quot;Co&quot; &lt;1&gt;");
    expect(xmlText("Café\n₹")).toBe("Caf&#233;&#10;&#8377;");
  });

  it("writes amounts with the currency's decimals, debits negative as Tally keeps them", () => {
    expect(tallyAmount(11800000n, 2)).toBe("-118000.00");
    expect(tallyAmount(-5n, 2)).toBe("0.05");
    expect(tallyAmount(1500n, 0)).toBe("-1500");
  });

  it("masters: each account a ledger under its group; customers and vendors bill-wise with address, state and GSTIN", () => {
    const xml = mastersXml(ledgers);
    expect(xml).toContain("<REPORTNAME>All Masters</REPORTNAME>");
    expect(xml).toContain('<LEDGER NAME="HDFC Current" ACTION="Create">');
    expect(xml).toMatch(/<NAME>Sales &#8212; Services<\/NAME><\/NAME\.LIST>\s*<PARENT>Sales Accounts<\/PARENT>/);
    expect(xml).toMatch(/<NAME>Lakeview Homes LLP<\/NAME><\/NAME\.LIST>\s*<PARENT>Sundry Debtors<\/PARENT>\s*<ISBILLWISEON>Yes<\/ISBILLWISEON>/);
    for (const tag of ["<ADDRESS>8 Indiranagar 2nd Stage</ADDRESS>", "<LEDSTATENAME>Karnataka</LEDSTATENAME>", "<COUNTRYNAME>India</COUNTRYNAME>", "<GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>", "<PARTYGSTIN>29AABFL0000B1ZA</PARTYGSTIN>"]) {
      expect(xml).toContain(tag);
    }
    expect(xml).toMatch(/<PARENT>Sundry Creditors<\/PARENT>/);
    expect((xml.match(/<LEDGER /g) ?? []).length).toBe(ledgers.length);
  });

  it("vouchers: the right type, balanced, debits first, with bill-wise references", () => {
    const xml = vouchersXml(vouchers, 2);
    expect(xml).toContain("<REPORTNAME>Vouchers</REPORTNAME>");
    expect(xml).toContain('VCHTYPE="Sales" ACTION="Create"');
    expect(xml).toContain("<DATE>20260910</DATE>");
    expect(xml).toContain("<VOUCHERNUMBER>INV-0001</VOUCHERNUMBER>");
    expect(xml).toContain("<PARTYLEDGERNAME>Lakeview Homes LLP</PARTYLEDGERNAME>");
    expect(xml).toMatch(/<NAME>INV-0001<\/NAME>\s*<BILLTYPE>New Ref<\/BILLTYPE>\s*<AMOUNT>-118000\.00<\/AMOUNT>/);
    expect(xml).toMatch(/<NAME>INV-0001<\/NAME>\s*<BILLTYPE>Agst Ref<\/BILLTYPE>\s*<AMOUNT>50000\.00<\/AMOUNT>/);
    expect(xml).toMatch(/<NAME>SCT-881<\/NAME>\s*<BILLTYPE>New Ref<\/BILLTYPE>/);
    for (const entries of voucherAmounts(xml)) {
      expect(entries.length).toBeGreaterThanOrEqual(2);
      expect(Math.round(entries.reduce((s, e) => s + e.amount, 0) * 100)).toBe(0);
      // Debits (deemed positive) are negative, and come first.
      for (const e of entries) expect(e.deemedPositive).toBe(e.amount < 0);
      expect(entries[0]!.deemedPositive).toBe(true);
    }
  });

  it("the README says how to import (masters, then transactions) and lists the accounts on default groups", () => {
    const text = readme();
    expect(text).toContain("Gateway of Tally > Import > Masters");
    expect(text).toContain("Gateway of Tally > Import > Transactions");
    expect(text).toContain("Gateway of Tally > Import of Data > Vouchers");
    expect(text).toContain("5000 Cost of Materials -> Direct Expenses");
  });

  it("the sample files kept in the repo are what the export writes", () => {
    const files = { "masters.xml": mastersXml(ledgers), "vouchers.xml": vouchersXml(vouchers, 2), "README.txt": readme() };
    if (process.env.UPDATE_TALLY_SAMPLES || !existsSync(join(SAMPLES, "masters.xml"))) {
      mkdirSync(SAMPLES, { recursive: true });
      for (const [name, body] of Object.entries(files)) writeFileSync(join(SAMPLES, name), body);
    }
    for (const [name, body] of Object.entries(files)) expect(readFileSync(join(SAMPLES, name), "utf8"), name).toBe(body);
  });
});
