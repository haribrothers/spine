/**
 * US-OPS-18 (security review) — CSV cells a spreadsheet would run as a
 * formula ("CSV injection"). Exports carry text from outside the business
 * (a customer's signer name, a bank statement's description), so a cell
 * starting with `=`, `+`, `-`, `@`, a tab or a carriage return is written
 * with a leading `'` and opens as text. Plain numbers, negative ones
 * included, are left alone. One rule for the API's `toCsv` and the web
 * app's `Papa.unparse` (as its `escapeFormulae`).
 */
export const CSV_FORMULA_CELL = /^(?!-?\d+(?:\.\d+)?$)[=+\-@\t\r]/;

/** The cell as written to a CSV file: guarded with `'` when it would run as a formula. */
export function neutraliseCsvFormula(value: string): string {
  return CSV_FORMULA_CELL.test(value) ? `'${value}` : value;
}

/** Undoes the guard when a Spine CSV is imported again, so a round trip keeps the text as it was. */
export function restoreCsvFormula(value: string): string {
  return value.startsWith("'") && CSV_FORMULA_CELL.test(value.slice(1)) ? value.slice(1) : value;
}
