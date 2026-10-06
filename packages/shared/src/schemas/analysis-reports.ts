import { z } from "zod";

/**
 * US-RPT-28, US-RPT-29 — sales and purchase analysis for a date range.
 * Customer, vendor and account totals come from `journal_lines`; item
 * quantities read invoice lines (the D-031 exception, stated on the page).
 */
export const analysisQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30."),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-30."),
  })
  .refine((q) => q.from <= q.to, "Choose a From date on or before the To date.");

/** A part's share of a whole as a percentage, one decimal, half away from zero; null when the whole is zero. */
export function sharePercent(part: bigint, whole: bigint): string | null {
  if (whole === 0n) return null;
  const hundredths = (part * 10000n) / whole;
  const rounded = (hundredths + (hundredths < 0n ? -5n : 5n)) / 10n;
  const sign = rounded < 0n ? "-" : "";
  const v = rounded < 0n ? -rounded : rounded;
  return `${sign}${v / 10n}.${v % 10n}`;
}

export interface AnalysisDocumentRef {
  id: string;
  number: string | null;
  date: string;
  /** Minor units. */
  total: string;
  href: string;
}

export const ITEMS_NOT_FROM_CATALOGUE = "Items not from the catalogue";

export interface SalesByCustomerRow {
  contactId: string;
  name: string;
  invoiceCount: number;
  /** Minor units, net of credit notes. */
  salesBeforeTax: string;
  tax: string;
  total: string;
  percentOfSales: string | null;
  invoices: AnalysisDocumentRef[];
}

export interface SalesByCustomerReport {
  from: string;
  to: string;
  rows: SalesByCustomerRow[];
  totals: { customers: number; invoiceCount: number; salesBeforeTax: string; tax: string; total: string };
}

export interface SalesByItemRow {
  /** Null for lines typed on the invoice rather than picked from the catalogue. */
  catalogItemId: string | null;
  name: string;
  quantity: number;
  salesBeforeTax: string;
  /** Sales before tax ÷ quantity; null when the quantity nets to zero. */
  averagePrice: string | null;
  invoices: AnalysisDocumentRef[];
}

export interface SalesByItemReport {
  from: string;
  to: string;
  rows: SalesByItemRow[];
  totals: { salesBeforeTax: string };
}
