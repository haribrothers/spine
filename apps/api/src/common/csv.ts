import type { Response } from "express";
import { neutraliseCsvFormula } from "@spine/shared";
/**
 * S-09.7 — "export any report to CSV, so my accountant can work with it."
 * One tiny shared writer rather than a dependency: quoting is RFC 4180
 * (wrap in double quotes and escape `"` as `""` whenever a field contains a
 * comma, quote, or newline), which is all any spreadsheet import needs.
 *
 * US-OPS-18 — a cell that would run as a formula in a spreadsheet gets a
 * leading `'` (`neutraliseCsvFormula`, the rule the web app's exports use too).
 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined): string => {
    const str = neutraliseCsvFormula(value === null || value === undefined ? "" : String(value));
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  return lines.join("\r\n");
}

/** Sends a CSV download (used by every report export). */
export function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
