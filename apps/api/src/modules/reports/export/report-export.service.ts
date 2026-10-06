import { BadRequestException, Injectable, StreamableFile } from "@nestjs/common";
import ExcelJS from "exceljs";
import { minorUnitExponent } from "@spine/shared";
import { toCsv } from "../../../common/csv";
import { SettingsService } from "../../org/settings.service";
import { decimalOf, EXPORT_FORMATS, type ExportFormat, type ReportCell, type ReportDocument } from "./report-document";

/** Excel number format for a currency's minor units: "#,##0.00", or "#,##0" for zero-decimal currencies. */
const moneyFormat = (currency: string) => {
  const places = minorUnitExponent(currency);
  return places ? `#,##0.${"0".repeat(places)};-#,##0.${"0".repeat(places)}` : "#,##0;-#,##0";
};

/**
 * US-RPT-32 (D-144) — writes a `ReportDocument` as CSV or Excel. CSV has
 * plain decimal amounts and the currency in its own column (as US-RPT-04);
 * Excel puts the business name, report name and range in the first rows,
 * bold headings, a frozen heading row and amounts as real numbers with the
 * currency's decimals.
 */
@Injectable()
export class ReportExportService {
  constructor(private readonly settings: SettingsService) {}

  /** `?format=` → a format, or undefined for the JSON report; anything else → 400. */
  static parseFormat(format: unknown): ExportFormat | undefined {
    if (format === undefined || format === "") return undefined;
    if (typeof format === "string" && (EXPORT_FORMATS as string[]).includes(format)) return format as ExportFormat;
    throw new BadRequestException("Choose CSV, Excel or PDF.");
  }

  /** The report as a download: CSV or Excel now; PDF with US-RPT-33. */
  async file(orgId: string, format: ExportFormat, report: Omit<ReportDocument, "currency">): Promise<StreamableFile> {
    const currency = (await this.settings.get<{ code?: string }>(orgId, "currency"))?.code ?? "USD";
    const doc: ReportDocument = { ...report, currency };
    if (format === "csv") {
      return new StreamableFile(Buffer.from(this.csv(doc), "utf8"), { type: "text/csv; charset=utf-8", disposition: `attachment; filename="${doc.filename}.csv"` });
    }
    if (format === "xlsx") {
      const buffer = await this.xlsx(doc, await this.businessName(orgId));
      return new StreamableFile(buffer, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", disposition: `attachment; filename="${doc.filename}.xlsx"` });
    }
    throw new BadRequestException("PDF export isn't available yet.");
  }

  csv(doc: ReportDocument): string {
    const hasMoney = doc.columns.some((c) => c.kind === "money");
    const headers = [...doc.columns.map((c) => c.header), ...(hasMoney ? ["Currency"] : [])];
    const rows = doc.rows.map((r) => [
      ...r.cells.map((cell, i) => {
        const kind = doc.columns[i]?.kind;
        if (kind === "money") return decimalOf(cell, doc.currency);
        return cell === null ? "" : String(cell);
      }),
      ...(hasMoney ? [r.style === "heading" ? "" : doc.currency] : []),
    ]);
    return toCsv(headers, rows);
  }

  async xlsx(doc: ReportDocument, business: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Spine";
    const sheet = workbook.addWorksheet(doc.title.slice(0, 31));
    sheet.addRow([business]).font = { bold: true, size: 13 };
    sheet.addRow([doc.title]).font = { bold: true };
    sheet.addRow([doc.subtitle]);
    sheet.addRow([`Amounts in ${doc.currency}`]);
    sheet.addRow([]);
    const header = sheet.addRow(doc.columns.map((c) => c.header));
    header.font = { bold: true };
    header.eachCell((cell, i) => {
      const kind = doc.columns[i - 1]?.kind;
      if (kind && kind !== "text") cell.alignment = { horizontal: "right" };
    });
    sheet.views = [{ state: "frozen", ySplit: header.number }];

    const divisor = 10 ** minorUnitExponent(doc.currency);
    const value = (cell: ReportCell, kind: string | undefined) => {
      if (cell === null || cell === "") return null;
      if (kind === "money") return Number(BigInt(cell)) / divisor;
      if (kind === "number") return Number(cell);
      if (kind === "percent") return Number(cell) / 100;
      return String(cell);
    };
    for (const r of doc.rows) {
      const row = sheet.addRow(r.cells.map((c, i) => value(c, doc.columns[i]?.kind)));
      if (r.style) row.font = { bold: true };
      if (r.style === "grand") row.eachCell((cell) => (cell.border = { top: { style: "thin" } }));
    }
    doc.columns.forEach((c, i) => {
      const column = sheet.getColumn(i + 1);
      if (c.kind === "money") column.numFmt = moneyFormat(doc.currency);
      if (c.kind === "percent") column.numFmt = "0.0%";
      column.width = c.kind === "text" ? Math.max(14, Math.min(48, c.header.length + 18)) : Math.max(14, c.header.length + 4);
    });
    if (doc.notes?.length) {
      sheet.addRow([]);
      for (const note of doc.notes) sheet.addRow([note]).font = { italic: true };
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async businessName(orgId: string): Promise<string> {
    const profile = await this.settings.get<{ name?: string }>(orgId, "business_profile");
    return profile?.name?.trim() || "Your business";
  }
}
