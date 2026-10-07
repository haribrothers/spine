import type { SupplyClass, SupplyType, TaxComponent } from "@spine/shared";

/**
 * US-TAX-16 (D-148) — the GSTR-1 tables from the period's invoices and credit
 * notes. Everything here is pure: the service loads the documents, this maps
 * them, so each table has fixture tests. Amounts stay in paise until the JSON
 * is written, where they become rupees with two decimals.
 */

/** The GST portal's GSTR-1 upload format this file follows, written into it. */
export const GSTR1_SCHEMA_VERSION = "GST3.2.4";
/** B2CL: an inter-state invoice to an unregistered buyer above ₹1,00,000 (from August 2024). */
export const B2CL_THRESHOLD = 10_000_000n;
/** The place of supply for exports. */
const OTHER_COUNTRIES = "96";

export interface Gstr1Line {
  name: string;
  hsnSac: string | null;
  quantity: number;
  /** Net of tax, in paise. */
  taxable: bigint;
  tax: bigint;
  supplyClass: SupplyClass | null;
  components: TaxComponent[];
}

export interface Gstr1Contact {
  id: string;
  name: string;
  gstTreatment: string | null;
  gstin: string | null;
}

export interface Gstr1Invoice {
  id: string;
  number: string;
  /** YYYY-MM-DD */
  date: string;
  /** The invoice total, tax included, in paise. */
  value: bigint;
  contact: Gstr1Contact;
  placeOfSupply: string | null;
  supplyType: SupplyType;
  lines: Gstr1Line[];
}

export interface Gstr1CreditNote extends Gstr1Invoice {
  /** The invoice it credits, wherever its period. */
  original: Pick<Gstr1Invoice, "number" | "date" | "value" | "contact" | "placeOfSupply" | "supplyType" | "lines">;
}

/** A numbered document issued in the period, for "Documents issued" (Table 13). */
export interface Gstr1IssuedDocument {
  kind: "invoice" | "credit_note";
  number: string;
  voided: boolean;
}

export interface Gstr1Input {
  gstin: string;
  /** The business's GST state, for supplies with no place of supply. */
  stateCode: string;
  fp: string;
  /** D-181 — exports go out under LUT, without IGST. */
  exportUnderLut: boolean;
  invoices: Gstr1Invoice[];
  creditNotes: Gstr1CreditNote[];
  issued: Gstr1IssuedDocument[];
}

export type Gstr1Category = "b2b" | "b2cl" | "b2cs" | "exp";

/** Where an invoice goes: exports, registered buyers (B2B), large inter-state unregistered (B2CL), or everything else (B2CS). */
export function invoiceCategory(doc: Pick<Gstr1Invoice, "contact" | "supplyType" | "value">): Gstr1Category {
  if (doc.supplyType === "export" || doc.contact.gstTreatment === "overseas") return "exp";
  if ((doc.contact.gstTreatment === "registered" || doc.contact.gstTreatment === "sez") && doc.contact.gstin) return "b2b";
  if (doc.supplyType === "inter" && doc.value > B2CL_THRESHOLD) return "b2cl";
  return "b2cs";
}

/** One rate's figures on a document, as the portal lists items. */
export interface Gstr1Item {
  rt: number;
  txval: bigint;
  iamt: bigint;
  camt: bigint;
  samt: bigint;
  csamt: bigint;
}

const NIL_CLASSES: readonly (SupplyClass | null)[] = ["exempt", "non_taxable"];

/** A line's GST rate: IGST, or CGST + SGST/UTGST (cess is separate). */
export function gstRate(components: readonly TaxComponent[]): number {
  const rate = components.filter((c) => c.taxType !== "cess").reduce((sum, c) => sum + c.rate, 0);
  return Math.round(rate * 100) / 100;
}

function itemOf(line: Gstr1Line): Gstr1Item {
  const sum = (types: string[]) => line.components.filter((c) => types.includes(c.taxType)).reduce((s, c) => s + c.amount, 0n);
  // A rate kept as a general type on a document without a supply type lands in IGST.
  const other = sum(["other", "vat", "gst", "sales_tax"]);
  return { rt: gstRate(line.components), txval: line.taxable, iamt: sum(["igst"]) + other, camt: sum(["cgst"]), samt: sum(["sgst", "utgst"]), csamt: sum(["cess"]) };
}

function addItem(into: Map<number, Gstr1Item>, item: Gstr1Item) {
  const existing = into.get(item.rt);
  if (!existing) into.set(item.rt, { ...item });
  else {
    existing.txval += item.txval;
    existing.iamt += item.iamt;
    existing.camt += item.camt;
    existing.samt += item.samt;
    existing.csamt += item.csamt;
  }
}

/**
 * The lines that go in a document's items, by rate. Exempt and non-GST lines
 * go to the nil table; so do zero-rated (nil-rated) lines on a domestic
 * supply to anyone but an SEZ. On exports and SEZ supplies, zero-rated lines
 * are items at 0%.
 */
export function documentItems(doc: Pick<Gstr1Invoice, "lines" | "supplyType" | "contact">): Gstr1Item[] {
  const zeroRatedIsItem = doc.supplyType === "export" || doc.contact.gstTreatment === "overseas" || doc.contact.gstTreatment === "sez";
  const byRate = new Map<number, Gstr1Item>();
  for (const line of doc.lines) {
    if (NIL_CLASSES.includes(line.supplyClass)) continue;
    if (line.tax === 0n && line.supplyClass === "zero_rated" && !zeroRatedIsItem) continue;
    addItem(byRate, itemOf(line));
  }
  return [...byRate.values()].sort((a, b) => a.rt - b.rt);
}

export interface NilRow {
  sply_ty: "INTRB2B" | "INTRAB2B" | "INTRB2C" | "INTRAB2C";
  nil: bigint;
  exempt: bigint;
  nonGst: bigint;
}

/** Nil-rated, exempt and non-GST values on a domestic document; null when it has none. */
function nilOf(doc: Pick<Gstr1Invoice, "lines" | "supplyType" | "contact">, sign: bigint): NilRow | null {
  const category = invoiceCategory({ ...doc, value: 0n });
  if (category === "exp" || doc.contact.gstTreatment === "sez") {
    // Exports and SEZ: only exempt and non-GST lines are nil supplies; zero-rated ones are items.
    const exempt = doc.lines.filter((l) => l.supplyClass === "exempt").reduce((s, l) => s + l.taxable, 0n) * sign;
    const nonGst = doc.lines.filter((l) => l.supplyClass === "non_taxable").reduce((s, l) => s + l.taxable, 0n) * sign;
    if (exempt === 0n && nonGst === 0n) return null;
    return { sply_ty: category === "b2b" ? "INTRB2B" : "INTRB2C", nil: 0n, exempt, nonGst };
  }
  const of = (cls: SupplyClass) => doc.lines.filter((l) => l.supplyClass === cls && l.tax === 0n).reduce((s, l) => s + l.taxable, 0n) * sign;
  const row = { nil: of("zero_rated"), exempt: of("exempt"), nonGst: of("non_taxable") };
  if (row.nil === 0n && row.exempt === 0n && row.nonGst === 0n) return null;
  const registered = category === "b2b";
  const intra = doc.supplyType === "intra";
  return { sply_ty: registered ? (intra ? "INTRAB2B" : "INTRB2B") : intra ? "INTRAB2C" : "INTRB2C", ...row };
}

export interface HsnRow {
  hsn_sc: string;
  desc: string;
  uqc: string;
  qty: number;
  rt: number;
  txval: bigint;
  iamt: bigint;
  camt: bigint;
  samt: bigint;
  csamt: bigint;
}

/** SAC codes (services) start with 99: no quantity, unit "NA". Goods have no unit in Spine yet, so they're "OTH". */
const isService = (code: string) => code.startsWith("99");

function addHsn(into: Map<string, HsnRow>, line: Gstr1Line, sign: bigint) {
  const code = line.hsnSac?.trim();
  if (!code) return;
  const item = itemOf(line);
  const service = isService(code);
  const key = `${code}|${item.rt}`;
  const row = into.get(key) ?? { hsn_sc: code, desc: line.name.slice(0, 30), uqc: service ? "NA" : "OTH", qty: 0, rt: item.rt, txval: 0n, iamt: 0n, camt: 0n, samt: 0n, csamt: 0n };
  if (!service) row.qty = Math.round((row.qty + Number(sign) * line.quantity) * 1000) / 1000;
  row.txval += item.txval * sign;
  row.iamt += item.iamt * sign;
  row.camt += item.camt * sign;
  row.samt += item.samt * sign;
  row.csamt += item.csamt * sign;
  into.set(key, row);
}

export interface DocumentRange {
  kind: "invoice" | "credit_note";
  from: string;
  to: string;
  total: number;
  cancelled: number;
}

/** "INV-0120" → ["INV-", 120]: series are the text before the trailing number. */
function splitNumber(number: string): [string, number] {
  const match = /^(.*?)(\d+)$/.exec(number);
  return match ? [match[1]!, Number(match[2])] : [number, 0];
}

/** Table 13: each series' first and last number, how many were issued and how many voided. */
export function documentRanges(issued: readonly Gstr1IssuedDocument[]): DocumentRange[] {
  const series = new Map<string, Gstr1IssuedDocument[]>();
  for (const doc of issued) {
    const key = `${doc.kind}|${splitNumber(doc.number)[0]}`;
    series.set(key, [...(series.get(key) ?? []), doc]);
  }
  return [...series.values()]
    .map((docs) => {
      const sorted = [...docs].sort((a, b) => splitNumber(a.number)[1] - splitNumber(b.number)[1]);
      return { kind: sorted[0]!.kind, from: sorted[0]!.number, to: sorted.at(-1)!.number, total: sorted.length, cancelled: sorted.filter((d) => d.voided).length };
    })
    .sort((a, b) => (a.kind === b.kind ? a.from.localeCompare(b.from) : a.kind === "invoice" ? -1 : 1));
}

export interface Gstr1DocumentEntry {
  doc: Gstr1Invoice;
  items: Gstr1Item[];
}

export interface Gstr1NoteEntry {
  doc: Gstr1CreditNote;
  /** cdnr for a registered buyer; cdnur for a B2CL or export invoice; b2cs otherwise (it reduces B2CS). */
  table: "cdnr" | "cdnur" | "b2cs";
  /** CDNUR's type. */
  cdnurType: "B2CL" | "EXPWP" | "EXPWOP" | null;
  items: Gstr1Item[];
}

export interface B2csRow {
  sply_ty: "INTRA" | "INTER";
  pos: string;
  rt: number;
  txval: bigint;
  iamt: bigint;
  camt: bigint;
  samt: bigint;
  csamt: bigint;
  /** Invoices and credit notes in this row. */
  documents: Set<string>;
}

export interface Gstr1Tables {
  b2b: Gstr1DocumentEntry[];
  b2cl: Gstr1DocumentEntry[];
  b2cs: B2csRow[];
  exp: (Gstr1DocumentEntry & { withPayment: boolean })[];
  cdnr: Gstr1NoteEntry[];
  cdnur: Gstr1NoteEntry[];
  nil: { rows: NilRow[]; documents: number };
  hsnB2b: HsnRow[];
  hsnB2c: HsnRow[];
  docs: DocumentRange[];
}

const hasIgst = (items: readonly Gstr1Item[]) => items.some((i) => i.iamt !== 0n);
export const posOf = (doc: Pick<Gstr1Invoice, "placeOfSupply" | "supplyType" | "contact">, stateCode: string) =>
  doc.placeOfSupply ?? (doc.supplyType === "export" || doc.contact.gstTreatment === "overseas" ? OTHER_COUNTRIES : stateCode);

/** Every GSTR-1 table, in paise. */
export function buildGstr1Tables(input: Gstr1Input): Gstr1Tables {
  const tables: Gstr1Tables = { b2b: [], b2cl: [], b2cs: [], exp: [], cdnr: [], cdnur: [], nil: { rows: [], documents: 0 }, hsnB2b: [], hsnB2c: [], docs: documentRanges(input.issued) };
  const b2cs = new Map<string, B2csRow>();
  const nil = new Map<NilRow["sply_ty"], NilRow>();
  const hsnB2b = new Map<string, HsnRow>();
  const hsnB2c = new Map<string, HsnRow>();
  let nilDocuments = 0;

  const addB2cs = (doc: Gstr1Invoice, items: Gstr1Item[], sign: bigint) => {
    const pos = posOf(doc, input.stateCode);
    const splyTy = doc.supplyType === "intra" ? "INTRA" : "INTER";
    for (const item of items) {
      const key = `${splyTy}|${pos}|${item.rt}`;
      const row = b2cs.get(key) ?? { sply_ty: splyTy, pos, rt: item.rt, txval: 0n, iamt: 0n, camt: 0n, samt: 0n, csamt: 0n, documents: new Set<string>() };
      row.txval += item.txval * sign;
      row.iamt += item.iamt * sign;
      row.camt += item.camt * sign;
      row.samt += item.samt * sign;
      row.csamt += item.csamt * sign;
      row.documents.add(doc.id);
      b2cs.set(key, row);
    }
  };
  const addNil = (doc: Gstr1Invoice, sign: bigint) => {
    const row = nilOf(doc, sign);
    if (!row) return;
    nilDocuments += 1;
    const existing = nil.get(row.sply_ty) ?? { sply_ty: row.sply_ty, nil: 0n, exempt: 0n, nonGst: 0n };
    existing.nil += row.nil;
    existing.exempt += row.exempt;
    existing.nonGst += row.nonGst;
    nil.set(row.sply_ty, existing);
  };

  for (const doc of input.invoices) {
    const category = invoiceCategory(doc);
    const items = documentItems(doc);
    if (category === "b2cs") addB2cs(doc, items, 1n);
    else if (category === "exp") tables.exp.push({ doc, items, withPayment: hasIgst(items) || (!input.exportUnderLut && items.some((i) => i.rt > 0)) });
    else if (items.length > 0) tables[category].push({ doc, items });
    if (category !== "exp" || doc.lines.some((l) => NIL_CLASSES.includes(l.supplyClass))) addNil(doc, 1n);
    for (const line of doc.lines) addHsn(category === "b2b" ? hsnB2b : hsnB2c, line, 1n);
  }

  for (const doc of input.creditNotes) {
    const items = documentItems(doc);
    const original = invoiceCategory(doc.original);
    const registered = (doc.contact.gstTreatment === "registered" || doc.contact.gstTreatment === "sez") && Boolean(doc.contact.gstin);
    if (registered) {
      if (items.length > 0) tables.cdnr.push({ doc, table: "cdnr", cdnurType: null, items });
    } else if (original === "b2cl" || original === "exp") {
      const cdnurType = original === "b2cl" ? "B2CL" : hasIgst(items) ? "EXPWP" : "EXPWOP";
      if (items.length > 0) tables.cdnur.push({ doc, table: "cdnur", cdnurType, items });
    } else {
      addB2cs(doc, items, -1n);
    }
    addNil(doc, -1n);
    for (const line of doc.lines) addHsn(registered ? hsnB2b : hsnB2c, line, -1n);
  }

  tables.b2cs = [...b2cs.values()].sort((a, b) => a.pos.localeCompare(b.pos) || a.rt - b.rt);
  tables.nil = { rows: [...nil.values()], documents: nilDocuments };
  const byCode = (a: HsnRow, b: HsnRow) => a.hsn_sc.localeCompare(b.hsn_sc) || a.rt - b.rt;
  tables.hsnB2b = [...hsnB2b.values()].sort(byCode);
  tables.hsnB2c = [...hsnB2c.values()].sort(byCode);
  return tables;
}

const itemsTax = (items: readonly Gstr1Item[]) => items.reduce((s, i) => s + i.iamt + i.camt + i.samt + i.csamt, 0n);
const itemsTaxable = (items: readonly Gstr1Item[]) => items.reduce((s, i) => s + i.txval, 0n);

export interface TableFigures {
  count: number;
  taxableValue: bigint;
  tax: bigint;
}

/** Counts and values per table, for the page and the totals check; credit notes are negative. */
export function tableFigures(tables: Gstr1Tables) {
  const docs = (entries: readonly { items: Gstr1Item[] }[], sign = 1n): TableFigures => ({
    count: entries.length,
    taxableValue: entries.reduce((s, e) => s + itemsTaxable(e.items), 0n) * sign,
    tax: entries.reduce((s, e) => s + itemsTax(e.items), 0n) * sign,
  });
  const b2csDocuments = new Set(tables.b2cs.flatMap((r) => [...r.documents]));
  const hsn = [...tables.hsnB2b, ...tables.hsnB2c];
  const figures = {
    b2b: docs(tables.b2b),
    b2cl: docs(tables.b2cl),
    b2cs: { count: b2csDocuments.size, taxableValue: tables.b2cs.reduce((s, r) => s + r.txval, 0n), tax: tables.b2cs.reduce((s, r) => s + r.iamt + r.camt + r.samt + r.csamt, 0n) },
    cdnr: docs(tables.cdnr, -1n),
    cdnur: docs(tables.cdnur, -1n),
    exp: docs(tables.exp),
    nil: { count: tables.nil.documents, taxableValue: tables.nil.rows.reduce((s, r) => s + r.nil + r.exempt + r.nonGst, 0n), tax: 0n },
    hsn: { count: new Set(hsn.map((r) => r.hsn_sc)).size, taxableValue: hsn.reduce((s, r) => s + r.txval, 0n), tax: hsn.reduce((s, r) => s + r.iamt + r.camt + r.samt + r.csamt, 0n) },
  };
  const taxed = [figures.b2b, figures.b2cl, figures.b2cs, figures.cdnr, figures.cdnur, figures.exp];
  return {
    ...figures,
    /** Tax across the tables that carry it — what the file reports. */
    totalTax: taxed.reduce((s, f) => s + f.tax, 0n),
    totalTaxable: taxed.reduce((s, f) => s + f.taxableValue, 0n) + figures.nil.taxableValue,
  };
}

/** Paise → rupees with two decimals, as a JSON number. */
export const rupees = (paise: bigint): number => {
  const sign = paise < 0n ? "-" : "";
  const abs = paise < 0n ? -paise : paise;
  return Number(`${sign}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`);
};

/** YYYY-MM-DD → DD-MM-YYYY. */
export const portalDate = (date: string) => `${date.slice(8, 10)}-${date.slice(5, 7)}-${date.slice(0, 4)}`;

const itemDetail = (item: Gstr1Item, intraOnly = false) => ({
  txval: rupees(item.txval),
  rt: item.rt,
  iamt: rupees(item.iamt),
  ...(intraOnly ? {} : { camt: rupees(item.camt), samt: rupees(item.samt) }),
  csamt: rupees(item.csamt),
});
const numbered = (items: readonly Gstr1Item[], intraOnly = false) => items.map((item, i) => ({ num: i + 1, itm_det: itemDetail(item, intraOnly) }));

/** Groups entries by a key, keeping first-seen order. */
function groupBy<T>(entries: readonly T[], key: (e: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const e of entries) map.set(key(e), [...(map.get(key(e)) ?? []), e]);
  return [...map.entries()];
}

/** The file the GST portal's offline tool takes, with this version written in it. */
export function gstr1Json(input: Gstr1Input, tables: Gstr1Tables) {
  const pos = (doc: Gstr1Invoice) => posOf(doc, input.stateCode);
  const hsnJson = (rows: readonly HsnRow[]) =>
    rows.map((r, i) => ({ num: i + 1, hsn_sc: r.hsn_sc, desc: r.desc, uqc: r.uqc, qty: r.qty, rt: r.rt, txval: rupees(r.txval), iamt: rupees(r.iamt), camt: rupees(r.camt), samt: rupees(r.samt), csamt: rupees(r.csamt) }));
  return {
    gstin: input.gstin,
    fp: input.fp,
    version: GSTR1_SCHEMA_VERSION,
    hash: "hash",
    b2b: groupBy(tables.b2b, (e) => e.doc.contact.gstin!).map(([ctin, entries]) => ({
      ctin,
      inv: entries.map(({ doc, items }) => ({
        inum: doc.number,
        idt: portalDate(doc.date),
        val: rupees(doc.value),
        pos: pos(doc),
        rchrg: "N",
        inv_typ: doc.contact.gstTreatment === "sez" ? (hasIgst(items) ? "SEWP" : "SEWOP") : "R",
        itms: numbered(items),
      })),
    })),
    b2cl: groupBy(tables.b2cl, (e) => pos(e.doc)).map(([placeOfSupply, entries]) => ({
      pos: placeOfSupply,
      inv: entries.map(({ doc, items }) => ({ inum: doc.number, idt: portalDate(doc.date), val: rupees(doc.value), itms: numbered(items, true) })),
    })),
    b2cs: tables.b2cs.map((r) => ({ sply_ty: r.sply_ty, pos: r.pos, typ: "OE", rt: r.rt, txval: rupees(r.txval), iamt: rupees(r.iamt), camt: rupees(r.camt), samt: rupees(r.samt), csamt: rupees(r.csamt) })),
    cdnr: groupBy(tables.cdnr, (e) => e.doc.contact.gstin!).map(([ctin, entries]) => ({
      ctin,
      nt: entries.map(({ doc, items }) => ({
        ntty: "C",
        nt_num: doc.number,
        nt_dt: portalDate(doc.date),
        val: rupees(doc.value),
        pos: pos(doc),
        rchrg: "N",
        inv_typ: doc.contact.gstTreatment === "sez" ? (hasIgst(items) ? "SEWP" : "SEWOP") : "R",
        // The invoice it credits, whatever period that was in.
        inum: doc.original.number,
        idt: portalDate(doc.original.date),
        itms: numbered(items),
      })),
    })),
    cdnur: tables.cdnur.map(({ doc, items, cdnurType }) => ({
      typ: cdnurType,
      ntty: "C",
      nt_num: doc.number,
      nt_dt: portalDate(doc.date),
      val: rupees(doc.value),
      ...(cdnurType === "B2CL" ? { pos: pos(doc) } : {}),
      inum: doc.original.number,
      idt: portalDate(doc.original.date),
      itms: numbered(items, true),
    })),
    exp: groupBy(tables.exp, (e) => (e.withPayment ? "WPAY" : "WOPAY")).map(([expTyp, entries]) => ({
      exp_typ: expTyp,
      inv: entries.map(({ doc, items }) => ({ inum: doc.number, idt: portalDate(doc.date), val: rupees(doc.value), itms: items.map((item) => ({ txval: rupees(item.txval), rt: item.rt, iamt: rupees(item.iamt), csamt: rupees(item.csamt) })) })),
    })),
    nil: { inv: tables.nil.rows.map((r) => ({ sply_ty: r.sply_ty, nil_amt: rupees(r.nil), expt_amt: rupees(r.exempt), ngsup_amt: rupees(r.nonGst) })) },
    hsn: { hsn_b2b: hsnJson(tables.hsnB2b), hsn_b2c: hsnJson(tables.hsnB2c) },
    doc_issue: {
      doc_det: (["invoice", "credit_note"] as const)
        .map((kind) => ({ kind, ranges: tables.docs.filter((d) => d.kind === kind) }))
        .filter((d) => d.ranges.length > 0)
        .map(({ kind, ranges }) => ({
          doc_num: kind === "invoice" ? 1 : 5,
          doc_typ: kind === "invoice" ? "Invoices for outward supply" : "Credit Note",
          docs: ranges.map((r, i) => ({ num: i + 1, from: r.from, to: r.to, totnum: r.total, cancel: r.cancelled, net_issue: r.total - r.cancelled })),
        })),
    },
  };
}
