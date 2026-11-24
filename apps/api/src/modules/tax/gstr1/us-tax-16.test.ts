import { describe, expect, it } from "vitest";
import type { TaxComponent } from "@spine/shared";
import { buildGstr1Tables, documentRanges, GSTR1_SCHEMA_VERSION, gstr1Json, tableFigures, type Gstr1Contact, type Gstr1CreditNote, type Gstr1Input, type Gstr1Invoice, type Gstr1Line } from "./gstr1-build";
import { parseGstr1Period } from "./period";

const GSTIN = "29AAACK0000A1ZK";
const registered: Gstr1Contact = { id: "c-reg", name: "Lakeview Homes LLP", gstTreatment: "registered", gstin: "29AABFL0000B1Z2" };
const mumbai: Gstr1Contact = { id: "c-mum", name: "Harbour Café LLP", gstTreatment: "registered", gstin: "27AAPFU0939F1ZV" };
const consumer: Gstr1Contact = { id: "c-con", name: "Anita Rao", gstTreatment: "consumer", gstin: null };
const overseas: Gstr1Contact = { id: "c-os", name: "Oslo Interiors AS", gstTreatment: "overseas", gstin: null };

const intra = (taxable: bigint, rate = 18): TaxComponent[] => {
  const half = (taxable * BigInt(rate * 50)) / 10000n;
  return [
    { taxType: "cgst", rate: rate / 2, amount: half },
    { taxType: "sgst", rate: rate / 2, amount: half },
  ];
};
const inter = (taxable: bigint, rate = 18): TaxComponent[] => [{ taxType: "igst", rate, amount: (taxable * BigInt(rate * 100)) / 10000n }];
const line = (taxable: bigint, components: TaxComponent[], extra: Partial<Gstr1Line> = {}): Gstr1Line => ({
  name: "Modular kitchen",
  hsnSac: "9403",
  quantity: 1,
  taxable,
  tax: components.reduce((s, c) => s + c.amount, 0n),
  supplyClass: components.length ? "taxable" : "zero_rated",
  components,
  ...extra,
});
const invoice = (over: Partial<Gstr1Invoice> & Pick<Gstr1Invoice, "number" | "contact" | "lines">): Gstr1Invoice => {
  const value = over.lines.reduce((s, l) => s + l.taxable + l.tax, 0n);
  return { id: over.number, date: "2026-09-10", value, placeOfSupply: "29", supplyType: "intra", ...over };
};
const input = (over: Partial<Gstr1Input>): Gstr1Input => ({ gstin: GSTIN, stateCode: "29", fp: "092026", exportUnderLut: false, invoices: [], creditNotes: [], issued: [], ...over });
const build = (over: Partial<Gstr1Input>) => {
  const i = input(over);
  const tables = buildGstr1Tables(i);
  return { tables, json: gstr1Json(i, tables), figures: tableFigures(tables) };
};

describe("US-TAX-16", () => {
  it("reads a month or a quarter, and the return period is the last month", () => {
    expect(parseGstr1Period("2026-09")).toEqual({ kind: "monthly", from: "2026-09-01", to: "2026-09-30", fp: "092026", label: "September 2026" });
    expect(parseGstr1Period("2026-Q3")).toEqual({ kind: "quarterly", from: "2026-07-01", to: "2026-09-30", fp: "092026", label: "Jul – Sep 2026" });
    expect(parseGstr1Period("2028-02").to).toBe("2028-02-29");
    expect(() => parseGstr1Period("2026-13")).toThrow("Choose a month (YYYY-MM) or a quarter (YYYY-Q1 to YYYY-Q4).");
  });

  it("writes the GSTIN, the period and the schema version into the file", () => {
    const { json } = build({});
    expect(json).toMatchObject({ gstin: GSTIN, fp: "092026", version: GSTR1_SCHEMA_VERSION });
  });

  it("B2B: registered customers, by GSTIN, one item per rate, dates as DD-MM-YYYY", () => {
    const { json, figures } = build({
      invoices: [
        invoice({ number: "INV-0120", contact: registered, lines: [line(18000000n, intra(18000000n)), line(2500000n, intra(2500000n), { hsnSac: "995472" }), line(1000000n, intra(1000000n, 5))] }),
        invoice({ number: "INV-0121", contact: mumbai, placeOfSupply: "27", supplyType: "inter", lines: [line(10000000n, inter(10000000n))] }),
      ],
    });
    expect(json.b2b).toEqual([
      {
        ctin: "29AABFL0000B1Z2",
        inv: [
          {
            inum: "INV-0120",
            idt: "10-09-2026",
            val: 252400,
            pos: "29",
            rchrg: "N",
            inv_typ: "R",
            itms: [
              { num: 1, itm_det: { txval: 10000, rt: 5, iamt: 0, camt: 250, samt: 250, csamt: 0 } },
              { num: 2, itm_det: { txval: 205000, rt: 18, iamt: 0, camt: 18450, samt: 18450, csamt: 0 } },
            ],
          },
        ],
      },
      { ctin: "27AAPFU0939F1ZV", inv: [{ inum: "INV-0121", idt: "10-09-2026", val: 118000, pos: "27", rchrg: "N", inv_typ: "R", itms: [{ num: 1, itm_det: { txval: 100000, rt: 18, iamt: 18000, camt: 0, samt: 0, csamt: 0 } }] }] },
    ]);
    expect(figures.b2b).toEqual({ count: 2, taxableValue: 31500000n, tax: 5540000n });
  });

  it("B2CL: inter-state to an unregistered buyer above ₹1,00,000, by place of supply; at or below it's B2CS", () => {
    const { json } = build({
      invoices: [
        invoice({ number: "INV-0122", contact: consumer, placeOfSupply: "33", supplyType: "inter", lines: [line(9000000n, inter(9000000n))] }),
        invoice({ number: "INV-0123", contact: consumer, placeOfSupply: "33", supplyType: "inter", lines: [line(8474576n, inter(8474576n))] }),
      ],
    });
    expect(json.b2cl).toEqual([{ pos: "33", inv: [{ inum: "INV-0122", idt: "10-09-2026", val: 106200, itms: [{ num: 1, itm_det: { txval: 90000, rt: 18, iamt: 16200, csamt: 0 } }] }] }]);
    expect(json.b2cs).toEqual([{ sply_ty: "INTER", pos: "33", typ: "OE", rt: 18, txval: 84745.76, iamt: 15254.23, camt: 0, samt: 0, csamt: 0 }]);
  });

  it("B2CS: other unregistered supplies summed by place of supply and rate; a credit note on one reduces it", () => {
    const sale = invoice({ number: "INV-0124", contact: consumer, lines: [line(5000000n, intra(5000000n))] });
    const other = invoice({ number: "INV-0125", contact: consumer, lines: [line(2500000n, intra(2500000n))] });
    const credit: Gstr1CreditNote = { ...invoice({ number: "CN-0004", contact: consumer, lines: [line(1000000n, intra(1000000n))] }), original: sale };
    const { json, figures } = build({ invoices: [sale, other], creditNotes: [credit] });
    expect(json.b2cs).toEqual([{ sply_ty: "INTRA", pos: "29", typ: "OE", rt: 18, txval: 65000, iamt: 0, camt: 5850, samt: 5850, csamt: 0 }]);
    expect(json.cdnur).toEqual([]);
    expect(figures.b2cs).toEqual({ count: 3, taxableValue: 6500000n, tax: 1170000n });
  });

  it("CDNR: a credit note to a registered customer carries the original invoice's number and date, even from an earlier period", () => {
    const august = invoice({ number: "INV-0098", date: "2026-08-14", contact: registered, lines: [line(18000000n, intra(18000000n))] });
    const credit: Gstr1CreditNote = { ...invoice({ number: "CN-0003", date: "2026-09-05", contact: registered, lines: [line(1000000n, intra(1000000n))] }), original: august };
    const { json, figures } = build({ creditNotes: [credit] });
    expect(json.cdnr).toEqual([
      {
        ctin: "29AABFL0000B1Z2",
        nt: [{ ntty: "C", nt_num: "CN-0003", nt_dt: "05-09-2026", val: 11800, pos: "29", rchrg: "N", inv_typ: "R", inum: "INV-0098", idt: "14-08-2026", itms: [{ num: 1, itm_det: { txval: 10000, rt: 18, iamt: 0, camt: 900, samt: 900, csamt: 0 } }] }],
      },
    ]);
    expect(figures.cdnr).toEqual({ count: 1, taxableValue: -1000000n, tax: -180000n });
  });

  it("CDNUR: credit notes on B2CL invoices and exports, with the original invoice", () => {
    const large = invoice({ number: "INV-0090", date: "2026-08-02", contact: consumer, placeOfSupply: "33", supplyType: "inter", lines: [line(20000000n, inter(20000000n))] });
    const exported = invoice({ number: "INV-0091", date: "2026-08-03", contact: overseas, placeOfSupply: "96", supplyType: "export", lines: [line(10000000n, inter(10000000n))] });
    const { json } = build({
      creditNotes: [
        { ...invoice({ number: "CN-0005", contact: consumer, placeOfSupply: "33", supplyType: "inter", lines: [line(1000000n, inter(1000000n))] }), original: large },
        { ...invoice({ number: "CN-0006", contact: overseas, placeOfSupply: "96", supplyType: "export", lines: [line(500000n, inter(500000n))] }), original: exported },
      ],
    });
    expect(json.cdnur).toEqual([
      { typ: "B2CL", ntty: "C", nt_num: "CN-0005", nt_dt: "10-09-2026", val: 11800, pos: "33", inum: "INV-0090", idt: "02-08-2026", itms: [{ num: 1, itm_det: { txval: 10000, rt: 18, iamt: 1800, csamt: 0 } }] },
      { typ: "EXPWP", ntty: "C", nt_num: "CN-0006", nt_dt: "10-09-2026", val: 5900, inum: "INV-0091", idt: "03-08-2026", itms: [{ num: 1, itm_det: { txval: 5000, rt: 18, iamt: 900, csamt: 0 } }] },
    ]);
  });

  it("Exports: with payment of IGST, or under LUT at 0%", () => {
    const { json, figures } = build({
      exportUnderLut: true,
      invoices: [
        invoice({ number: "INV-0126", contact: overseas, placeOfSupply: "96", supplyType: "export", lines: [line(31000000n, inter(31000000n))] }),
        invoice({ number: "INV-0127", contact: overseas, placeOfSupply: "96", supplyType: "export", lines: [line(5000000n, [], { supplyClass: "zero_rated" })] }),
      ],
    });
    expect(json.exp).toEqual([
      { exp_typ: "WPAY", inv: [{ inum: "INV-0126", idt: "10-09-2026", val: 365800, itms: [{ txval: 310000, rt: 18, iamt: 55800, csamt: 0 }] }] },
      { exp_typ: "WOPAY", inv: [{ inum: "INV-0127", idt: "10-09-2026", val: 50000, itms: [{ txval: 50000, rt: 0, iamt: 0, csamt: 0 }] }] },
    ]);
    expect(json.nil.inv).toEqual([]);
    expect(figures.exp).toEqual({ count: 2, taxableValue: 36000000n, tax: 5580000n });
  });

  it("Nil, exempt and non-GST: by inter/intra and registered/unregistered", () => {
    const { json, figures } = build({
      invoices: [
        invoice({
          number: "INV-0128",
          contact: consumer,
          lines: [line(4500000n, [], { supplyClass: "exempt", hsnSac: "998391" }), line(1000000n, [], { supplyClass: "zero_rated" })],
        }),
        invoice({ number: "INV-0129", contact: mumbai, placeOfSupply: "27", supplyType: "inter", lines: [line(840000n, [], { supplyClass: "non_taxable" })] }),
      ],
    });
    expect(json.nil.inv).toEqual([
      { sply_ty: "INTRAB2C", nil_amt: 10000, expt_amt: 45000, ngsup_amt: 0 },
      { sply_ty: "INTRB2B", nil_amt: 0, expt_amt: 0, ngsup_amt: 8400 },
    ]);
    expect(json.b2b).toEqual([]);
    expect(json.b2cs).toEqual([]);
    expect(figures.nil).toEqual({ count: 2, taxableValue: 6340000n, tax: 0n });
  });

  it("HSN summary: split B2B and B2C, services with unit NA and no quantity, goods with their quantity, credit notes netted", () => {
    const sale = invoice({ number: "INV-0130", contact: registered, lines: [line(18000000n, intra(18000000n), { quantity: 2 }), line(2500000n, intra(2500000n), { hsnSac: "995472", name: "Installation and site supervision" })] });
    const toConsumer = invoice({ number: "INV-0131", contact: consumer, lines: [line(5000000n, intra(5000000n)), line(100000n, intra(100000n), { hsnSac: null })] });
    const credit: Gstr1CreditNote = { ...invoice({ number: "CN-0007", contact: registered, lines: [line(1000000n, intra(1000000n), { quantity: 1 })] }), original: sale };
    const { json } = build({ invoices: [sale, toConsumer], creditNotes: [credit] });
    expect(json.hsn.hsn_b2b).toEqual([
      { num: 1, hsn_sc: "9403", desc: "Modular kitchen", uqc: "OTH", qty: 1, rt: 18, txval: 170000, iamt: 0, camt: 15300, samt: 15300, csamt: 0 },
      { num: 2, hsn_sc: "995472", desc: "Installation and site supervis", uqc: "NA", qty: 0, rt: 18, txval: 25000, iamt: 0, camt: 2250, samt: 2250, csamt: 0 },
    ]);
    // The line with no HSN/SAC stays out (US-TAX-17 lists it as a problem).
    expect(json.hsn.hsn_b2c).toEqual([{ num: 1, hsn_sc: "9403", desc: "Modular kitchen", uqc: "OTH", qty: 1, rt: 18, txval: 50000, iamt: 0, camt: 4500, samt: 4500, csamt: 0 }]);
  });

  it("Documents issued: each series' range with totals and voided counts", () => {
    const issued = [
      ...["INV-0120", "INV-0121", "INV-0122", "INV-0147", "INV-0130"].map((number) => ({ kind: "invoice" as const, number, voided: number === "INV-0122" })),
      { kind: "credit_note" as const, number: "CN-0003", voided: false },
      { kind: "credit_note" as const, number: "CN-0004", voided: false },
    ];
    expect(documentRanges(issued)).toEqual([
      { kind: "invoice", from: "INV-0120", to: "INV-0147", total: 5, cancelled: 1 },
      { kind: "credit_note", from: "CN-0003", to: "CN-0004", total: 2, cancelled: 0 },
    ]);
    expect(build({ issued }).json.doc_issue).toEqual({
      doc_det: [
        { doc_num: 1, doc_typ: "Invoices for outward supply", docs: [{ num: 1, from: "INV-0120", to: "INV-0147", totnum: 5, cancel: 1, net_issue: 4 }] },
        { doc_num: 5, doc_typ: "Credit Note", docs: [{ num: 1, from: "CN-0003", to: "CN-0004", totnum: 2, cancel: 0, net_issue: 2 }] },
      ],
    });
  });

  it("the file's total tax is every table's tax, credit notes taken off", () => {
    const sale = invoice({ number: "INV-0140", contact: registered, lines: [line(10000000n, intra(10000000n))] });
    const { figures } = build({
      invoices: [sale, invoice({ number: "INV-0141", contact: consumer, lines: [line(1000000n, intra(1000000n))] })],
      creditNotes: [{ ...invoice({ number: "CN-0008", contact: registered, lines: [line(1000000n, intra(1000000n))] }), original: sale }],
    });
    expect(figures.totalTax).toBe(1800000n);
  });
});
