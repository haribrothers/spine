import { periodLabel, toDecimalString } from "@spine/shared";

/**
 * US-RPT-32–US-RPT-34 (D-144) — one shape every report exports through:
 * a title, the range or date, typed columns and styled rows. CSV, Excel
 * and PDF all render from it, so a file holds exactly what the page shows.
 */
export type ReportColumnKind = "text" | "money" | "number" | "percent";

export interface ReportColumn {
  header: string;
  kind: ReportColumnKind;
}

/** Money is minor units (bigint or its string); percent is "16.8" (no sign); text and numbers as they are. */
export type ReportCell = string | number | bigint | null;

export interface ReportRow {
  cells: ReportCell[];
  /** "heading" starts a section; "total" and "grand" are bold, grand with a rule above. */
  style?: "heading" | "total" | "grand";
}

export interface ReportDocument {
  title: string;
  /** "Jul 1 – Sep 30, 2026 · Accrual basis", "As of Sep 30, 2026". */
  subtitle: string;
  /** `<report>-<from>-<to>` or `<report>-<asOf>`, without the extension (D-144). */
  filename: string;
  currency: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  notes?: string[];
}

export type ExportFormat = "csv" | "xlsx" | "pdf";
export const EXPORT_FORMATS: ExportFormat[] = ["csv", "xlsx", "pdf"];

/** "Jul 1 – Sep 30, 2026". */
export const rangeText = (from: string, to: string) => periodLabel(from, to);
/** "As of Sep 30, 2026". */
export const asOfText = (asOf: string) => `As of ${periodLabel(asOf, asOf)}`;

/** Minor units → the plain decimal string CSV carries ("1240.00", "-5.50"). */
export function decimalOf(cell: ReportCell, currency: string): string {
  if (cell === null || cell === "") return "";
  return toDecimalString({ amount: BigInt(cell), currency });
}

/** A heading row: the label in the first column, nothing else. */
export function heading(label: string, width: number): ReportRow {
  return { cells: [label, ...Array<ReportCell>(width - 1).fill(null)], style: "heading" };
}

/** The DataTable search rule, applied to exports so they hold what's on screen. */
export function matchesSearch(text: string, search: string | undefined): boolean {
  const query = search?.trim().toLowerCase();
  return !query || text.toLowerCase().includes(query);
}
