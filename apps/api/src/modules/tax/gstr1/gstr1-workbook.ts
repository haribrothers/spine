import ExcelJS from "exceljs";
import { gstState } from "@spine/shared";
import type { Gstr1Input, gstr1Json } from "./gstr1-build";
import type { Gstr1Problem } from "./gstr1-problems";

type Gstr1Json = ReturnType<typeof gstr1Json>;
type Cell = string | number | undefined;

const MONEY = "#,##0.00;-#,##0.00";
const NIL_LABELS: Record<string, string> = {
  INTRB2B: "Inter-state supplies to registered persons",
  INTRAB2B: "Intra-state supplies to registered persons",
  INTRB2C: "Inter-state supplies to unregistered persons",
  INTRAB2C: "Intra-state supplies to unregistered persons",
};

/** "29-Karnataka", as the offline tool's sheets write a place of supply. */
const posText = (code: string | undefined) => (code ? `${code}-${gstState(code)?.name ?? "Other countries"}` : "");

/**
 * US-TAX-17 — the review workbook: one sheet per GSTR-1 table plus
 * "Problems". It's built from the JSON itself, so the figures are the same.
 * Amounts are rupees, as numbers with two decimals.
 */
export async function gstr1Workbook(json: Gstr1Json, input: Pick<Gstr1Input, "invoices" | "creditNotes">, problems: readonly Gstr1Problem[], footer: string, appUrl: string): Promise<Buffer> {
  const names = new Map([...input.invoices, ...input.creditNotes].map((d) => [d.number, d.contact.name]));
  const workbook = new ExcelJS.Workbook();
  const sheet = (name: string, headers: string[], rows: Cell[][], money: number[] = []) => {
    const ws = workbook.addWorksheet(name);
    ws.addRow(headers).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const row of rows) ws.addRow(row);
    headers.forEach((h, i) => {
      const column = ws.getColumn(i + 1);
      column.width = Math.max(12, h.length + 2);
      if (money.includes(i)) column.numFmt = MONEY;
    });
    return ws;
  };

  sheet(
    "b2b",
    ["GSTIN/UIN of recipient", "Receiver name", "Invoice number", "Invoice date", "Invoice value", "Place of supply", "Reverse charge", "Invoice type", "Rate", "Taxable value", "Integrated tax", "Central tax", "State/UT tax", "Cess"],
    json.b2b.flatMap((r) =>
      r.inv.flatMap((inv) => inv.itms.map((i) => [r.ctin, names.get(inv.inum) ?? "", inv.inum, inv.idt, inv.val, posText(inv.pos), inv.rchrg, inv.inv_typ, i.itm_det.rt, i.itm_det.txval, i.itm_det.iamt, i.itm_det.camt, i.itm_det.samt, i.itm_det.csamt])),
    ),
    [4, 9, 10, 11, 12, 13],
  );
  sheet(
    "b2cl",
    ["Invoice number", "Invoice date", "Invoice value", "Place of supply", "Rate", "Taxable value", "Integrated tax", "Cess"],
    json.b2cl.flatMap((r) => r.inv.flatMap((inv) => inv.itms.map((i) => [inv.inum, inv.idt, inv.val, posText(r.pos), i.itm_det.rt, i.itm_det.txval, i.itm_det.iamt, i.itm_det.csamt]))),
    [2, 5, 6, 7],
  );
  sheet(
    "b2cs",
    ["Type", "Place of supply", "Supply type", "Rate", "Taxable value", "Integrated tax", "Central tax", "State/UT tax", "Cess"],
    json.b2cs.map((r) => [r.typ, posText(r.pos), r.sply_ty === "INTRA" ? "Intra-state" : "Inter-state", r.rt, r.txval, r.iamt, r.camt, r.samt, r.csamt]),
    [4, 5, 6, 7, 8],
  );
  sheet(
    "cdnr",
    ["GSTIN/UIN of recipient", "Receiver name", "Note number", "Note date", "Note type", "Original invoice", "Original invoice date", "Place of supply", "Note value", "Rate", "Taxable value", "Integrated tax", "Central tax", "State/UT tax", "Cess"],
    json.cdnr.flatMap((r) =>
      r.nt.flatMap((nt) =>
        nt.itms.map((i) => [r.ctin, names.get(nt.nt_num) ?? "", nt.nt_num, nt.nt_dt, nt.ntty, nt.inum, nt.idt, posText(nt.pos), nt.val, i.itm_det.rt, i.itm_det.txval, i.itm_det.iamt, i.itm_det.camt, i.itm_det.samt, i.itm_det.csamt]),
      ),
    ),
    [8, 10, 11, 12, 13, 14],
  );
  sheet(
    "cdnur",
    ["UR type", "Note number", "Note date", "Note type", "Original invoice", "Original invoice date", "Place of supply", "Note value", "Rate", "Taxable value", "Integrated tax", "Cess"],
    json.cdnur.flatMap((nt) => nt.itms.map((i) => [nt.typ ?? "", nt.nt_num, nt.nt_dt, nt.ntty, nt.inum, nt.idt, posText("pos" in nt ? (nt.pos as string) : undefined), nt.val, i.itm_det.rt, i.itm_det.txval, i.itm_det.iamt, i.itm_det.csamt])),
    [7, 9, 10, 11],
  );
  sheet(
    "exp",
    ["Export type", "Invoice number", "Invoice date", "Invoice value", "Rate", "Taxable value", "Integrated tax", "Cess"],
    json.exp.flatMap((r) => r.inv.flatMap((inv) => inv.itms.map((i) => [r.exp_typ, inv.inum, inv.idt, inv.val, i.rt, i.txval, i.iamt, i.csamt]))),
    [3, 5, 6, 7],
  );
  sheet(
    "exemp",
    ["Description", "Nil rated supplies", "Exempted (other than nil rated/non-GST supply)", "Non-GST supplies"],
    json.nil.inv.map((r) => [NIL_LABELS[r.sply_ty] ?? r.sply_ty, r.nil_amt, r.expt_amt, r.ngsup_amt]),
    [1, 2, 3],
  );
  const hsnRows = (rows: Gstr1Json["hsn"]["hsn_b2b"]) => rows.map((r) => [r.hsn_sc, r.desc, r.uqc, r.qty, r.rt, r.txval, r.iamt, r.camt, r.samt, r.csamt]);
  const hsnHeaders = ["HSN", "Description", "UQC", "Total quantity", "Rate", "Taxable value", "Integrated tax", "Central tax", "State/UT tax", "Cess"];
  sheet("hsn(b2b)", hsnHeaders, hsnRows(json.hsn.hsn_b2b), [5, 6, 7, 8, 9]);
  sheet("hsn(b2c)", hsnHeaders, hsnRows(json.hsn.hsn_b2c), [5, 6, 7, 8, 9]);
  sheet(
    "docs",
    ["Nature of document", "Sr. no. from", "Sr. no. to", "Total number", "Cancelled", "Net issued"],
    json.doc_issue.doc_det.flatMap((d) => d.docs.map((r) => [d.doc_typ, r.from, r.to, r.totnum, r.cancel, r.net_issue])),
  );
  const problemsSheet = sheet(
    "Problems",
    ["Problem", "Fix it"],
    problems.length ? problems.map((p) => [p.label, `${appUrl}${p.href}`]) : [["Nothing to fix.", ""]],
  );
  problemsSheet.getColumn(1).width = 90;
  problemsSheet.getColumn(2).width = 60;
  problemsSheet.addRow([]);
  problemsSheet.addRow([footer]).font = { italic: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
