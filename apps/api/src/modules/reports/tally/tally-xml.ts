/**
 * US-RPT-38 (D-149) — Tally XML from a plain model, so masters, vouchers and
 * the README each have fixture tests. The files use Tally's classic import
 * envelope (`IMPORTDATA`), which TallyPrime and Tally.ERP 9 both read.
 */

export const TALLY_VOUCHER_TYPES = ["Sales", "Purchase", "Receipt", "Payment", "Contra", "Journal", "Credit Note", "Debit Note"] as const;
export type TallyVoucherType = (typeof TALLY_VOUCHER_TYPES)[number];

export interface TallyParty {
  address: string[];
  state: string | null;
  country: string | null;
  gstin: string | null;
  /** Tally's GST registration types. */
  registrationType: "Regular" | "Consumer" | "Unregistered" | null;
}

export interface TallyLedger {
  name: string;
  parent: string;
  /** Customers and vendors: bill-wise on, with address and GST details. */
  party?: TallyParty;
}

export interface TallyBill {
  name: string;
  type: "New Ref" | "Agst Ref" | "On Account";
  /** Minor units, debit positive, same sign as its ledger entry. */
  amount: bigint;
}

export interface TallyEntry {
  ledger: string;
  /** Minor units: debit positive, credit negative. */
  amount: bigint;
  bills?: TallyBill[];
}

export interface TallyVoucher {
  /** The journal entry's id, so a re-import is recognised. */
  id: string;
  type: TallyVoucherType;
  /** YYYY-MM-DD */
  date: string;
  number: string | null;
  narration: string;
  partyLedger: string | null;
  entries: TallyEntry[];
}

/** XML text: escaped, and anything beyond ASCII as a character reference, which every Tally release reads. */
export function xmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[^\x20-\x7e]/gu, (ch) => (ch === "\n" ? "&#10;" : `&#${ch.codePointAt(0)};`));
}

/** Minor units → "1234.50" with the currency's decimals. Tally writes debits negative, so the sign is flipped. */
export function tallyAmount(minor: bigint, decimals: number): string {
  const tally = -minor;
  const sign = tally < 0n ? "-" : "";
  const abs = tally < 0n ? -tally : tally;
  if (decimals === 0) return `${sign}${abs}`;
  const scale = 10n ** BigInt(decimals);
  return `${sign}${abs / scale}.${String(abs % scale).padStart(decimals, "0")}`;
}

const tallyDate = (date: string) => date.replaceAll("-", "");
const yesNo = (v: boolean) => (v ? "Yes" : "No");

function envelope(reportName: "All Masters" | "Vouchers", messages: string[]): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<ENVELOPE>",
    " <HEADER>",
    "  <TALLYREQUEST>Import Data</TALLYREQUEST>",
    " </HEADER>",
    " <BODY>",
    "  <IMPORTDATA>",
    "   <REQUESTDESC>",
    `    <REPORTNAME>${reportName}</REPORTNAME>`,
    "   </REQUESTDESC>",
    "   <REQUESTDATA>",
    ...messages,
    "   </REQUESTDATA>",
    "  </IMPORTDATA>",
    " </BODY>",
    "</ENVELOPE>",
    "",
  ].join("\n");
}

/** `masters.xml`: one LEDGER per account used and per customer or vendor. */
export function mastersXml(ledgers: readonly TallyLedger[]): string {
  return envelope(
    "All Masters",
    ledgers.map((l) => {
      const name = xmlText(l.name);
      const lines = [
        '    <TALLYMESSAGE xmlns:UDF="TallyUDF">',
        `     <LEDGER NAME="${name}" ACTION="Create">`,
        `      <NAME.LIST><NAME>${name}</NAME></NAME.LIST>`,
        `      <PARENT>${xmlText(l.parent)}</PARENT>`,
      ];
      if (l.party) {
        const p = l.party;
        lines.push("      <ISBILLWISEON>Yes</ISBILLWISEON>");
        if (p.address.length) lines.push('      <ADDRESS.LIST TYPE="String">', ...p.address.map((a) => `       <ADDRESS>${xmlText(a)}</ADDRESS>`), "      </ADDRESS.LIST>");
        if (p.state) lines.push(`      <LEDSTATENAME>${xmlText(p.state)}</LEDSTATENAME>`);
        if (p.country) lines.push(`      <COUNTRYNAME>${xmlText(p.country)}</COUNTRYNAME>`);
        if (p.registrationType) lines.push(`      <GSTREGISTRATIONTYPE>${p.registrationType}</GSTREGISTRATIONTYPE>`);
        if (p.gstin) lines.push(`      <PARTYGSTIN>${xmlText(p.gstin)}</PARTYGSTIN>`);
      }
      lines.push("     </LEDGER>", "    </TALLYMESSAGE>");
      return lines.join("\n");
    }),
  );
}

/** `vouchers.xml`: one VOUCHER per journal entry, each balanced, debits first. */
export function vouchersXml(vouchers: readonly TallyVoucher[], decimals: number): string {
  return envelope(
    "Vouchers",
    vouchers.map((v) => {
      const lines = [
        '    <TALLYMESSAGE xmlns:UDF="TallyUDF">',
        `     <VOUCHER REMOTEID="spine-${v.id}" VCHTYPE="${xmlText(v.type)}" ACTION="Create" OBJVIEW="Accounting Voucher View">`,
        `      <DATE>${tallyDate(v.date)}</DATE>`,
        `      <VOUCHERTYPENAME>${xmlText(v.type)}</VOUCHERTYPENAME>`,
        ...(v.number ? [`      <VOUCHERNUMBER>${xmlText(v.number)}</VOUCHERNUMBER>`, `      <REFERENCE>${xmlText(v.number)}</REFERENCE>`] : []),
        ...(v.partyLedger ? [`      <PARTYLEDGERNAME>${xmlText(v.partyLedger)}</PARTYLEDGERNAME>`] : []),
        `      <NARRATION>${xmlText(v.narration)}</NARRATION>`,
        "      <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>",
        "      <ISINVOICE>No</ISINVOICE>",
      ];
      const ordered = [...v.entries].sort((a, b) => (a.amount > 0n === b.amount > 0n ? 0 : a.amount > 0n ? -1 : 1));
      for (const e of ordered) {
        lines.push(
          "      <ALLLEDGERENTRIES.LIST>",
          `       <LEDGERNAME>${xmlText(e.ledger)}</LEDGERNAME>`,
          `       <ISDEEMEDPOSITIVE>${yesNo(e.amount > 0n)}</ISDEEMEDPOSITIVE>`,
          `       <ISPARTYLEDGER>${yesNo(e.ledger === v.partyLedger)}</ISPARTYLEDGER>`,
          `       <AMOUNT>${tallyAmount(e.amount, decimals)}</AMOUNT>`,
        );
        for (const b of e.bills ?? []) {
          lines.push("       <BILLALLOCATIONS.LIST>", `        <NAME>${xmlText(b.name)}</NAME>`, `        <BILLTYPE>${b.type}</BILLTYPE>`, `        <AMOUNT>${tallyAmount(b.amount, decimals)}</AMOUNT>`, "       </BILLALLOCATIONS.LIST>");
        }
        lines.push("      </ALLLEDGERENTRIES.LIST>");
      }
      lines.push("     </VOUCHER>", "    </TALLYMESSAGE>");
      return lines.join("\n");
    }),
  );
}

/** `README.txt`: how to import, what's in the files, and the accounts still on their default group. */
export function readmeText(input: {
  business: string;
  from: string;
  to: string;
  ledgers: number;
  counts: { type: TallyVoucherType; count: number }[];
  defaults: { code: string; name: string; group: string }[];
}): string {
  const lines = [
    `Spine export to Tally — ${input.business}`,
    `Period: ${input.from} to ${input.to}`,
    "",
    "HOW TO IMPORT",
    "1. In Tally, open (or create) the company. Its books must begin on or before the first date above.",
    "2. TallyPrime: Gateway of Tally > Import > Masters, choose masters.xml.",
    "   Tally.ERP 9: Gateway of Tally > Import of Data > Masters, choose masters.xml.",
    "3. Then import the transactions: TallyPrime: Gateway of Tally > Import > Transactions, choose vouchers.xml.",
    "   Tally.ERP 9: Gateway of Tally > Import of Data > Vouchers, choose vouchers.xml.",
    "4. Check the import log in Tally, then compare the Trial Balance with Spine's for the same dates.",
    "",
    "WHAT'S IN THE FILES",
    `masters.xml: ${input.ledgers} ledgers — every account used in the period under its Tally group, customers under Sundry Debtors and vendors under Sundry Creditors (with address, state and GSTIN).`,
    "vouchers.xml: one voucher per journal entry, balanced, with bill-wise references to the invoice or bill number:",
    ...input.counts.map((c) => `  ${c.type}: ${c.count}`),
    "",
  ];
  if (input.defaults.length) {
    lines.push("ACCOUNTS ON SPINE'S DEFAULT GROUP", "Nobody has chosen a Tally group for these, so they use the default for their type and code. Change them in Spine: Reports > Export to Tally > Account mapping.");
    for (const d of input.defaults) lines.push(`  ${d.code} ${d.name} -> ${d.group}`);
    lines.push("");
  }
  lines.push("Spine prepares these files; your accountant imports and checks them in Tally.", "");
  return lines.join("\r\n");
}
