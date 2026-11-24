import { z } from "zod";

/**
 * US-CAT-09 (D-161) — importing catalogue items from a CSV. The browser
 * reads the file and maps its columns; the API matches tax and accounts,
 * skips duplicate names and reports failed rows. `dryRun` gives the preview.
 */
export const MAX_CATALOG_IMPORT_ROWS = 2000;

export const CATALOG_IMPORT_FIELDS = ["name", "description", "unit", "category", "price", "tax", "hsnSac", "incomeAccount", "expenseAccount"] as const;
export type CatalogImportField = (typeof CATALOG_IMPORT_FIELDS)[number];
export const CATALOG_IMPORT_FIELD_LABELS: Record<CatalogImportField, string> = {
  name: "Name",
  description: "Description",
  unit: "Unit",
  // US-CAT-12 — so an exported file imports back.
  category: "Category",
  price: "Price",
  tax: "Tax",
  // US-TAX-14
  hsnSac: "HSN/SAC code",
  incomeAccount: "Income account",
  expenseAccount: "Expense account",
};

const cell = z.string().trim().max(500).optional();

export const catalogImportRowSchema = z.object({
  /** The row's line number in the file, for messages and the failed-rows download. */
  row: z.number().int().min(1),
  name: cell,
  description: cell,
  unit: cell,
  category: cell,
  price: cell,
  tax: cell,
  hsnSac: cell,
  incomeAccount: cell,
  expenseAccount: cell,
});
export type CatalogImportRow = z.infer<typeof catalogImportRowSchema>;

export const importCatalogItemsSchema = z.object({
  rows: z.array(catalogImportRowSchema).min(1, "The file has no rows to import.").max(MAX_CATALOG_IMPORT_ROWS, `Import ${MAX_CATALOG_IMPORT_ROWS} rows or fewer at a time.`),
  dryRun: z.boolean().default(false),
});

export const UNKNOWN_TAX = (name: string) => `Unknown tax ${name}`;
/** US-TAX-14 — a code that isn't 4, 6 or 8 digits. */
export const BAD_HSN_SAC = (code: string) => `HSN/SAC ${code}: enter 4, 6 or 8 digits.`;
export const UNKNOWN_ACCOUNT = (code: string) => `Unknown account ${code}`;
export const CATALOG_IMPORT_SUMMARY = (imported: number, duplicates: number, failed: number) =>
  `Imported ${imported} ${imported === 1 ? "item" : "items"} · skipped ${duplicates} ${duplicates === 1 ? "duplicate" : "duplicates"} · ${failed} ${failed === 1 ? "row" : "rows"} failed`;

export interface CatalogImportRowResult {
  row: number;
  name: string;
  status: "ok" | "duplicate" | "failed";
  /** Why it was skipped or failed. */
  reason: string | null;
}

export interface CatalogImportResult {
  dryRun: boolean;
  /** Items created (0 on a dry run). */
  imported: number;
  rows: CatalogImportRowResult[];
}
