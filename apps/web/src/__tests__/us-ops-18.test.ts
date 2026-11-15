import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { CSV_FORMULA_CELL, restoreCsvFormula } from "@spine/shared";

/**
 * US-OPS-18 (security review) — the CSVs the web app writes (the catalog
 * export, the catalog import's rows with problems) can't carry a formula, and
 * importing one again gives back the text as it was. The importers (contacts,
 * catalog, opening invoices and bills) parse with `transform: restoreCsvFormula`.
 */
describe("US-OPS-18 · web CSV exports guard formulas", () => {
  const rows = [
    { Name: "=HYPERLINK(\"https://evil.example\",\"Tiles\")", Price: "-40.50", Unit: "+box" },
    { Name: "Grout", Price: "12", Unit: "bag" },
  ];

  it("writes a formula-like cell as text and leaves negative amounts alone", () => {
    const csv = Papa.unparse(rows, { escapeFormulae: CSV_FORMULA_CELL });
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('"\'=HYPERLINK(""https://evil.example"",""Tiles"")",-40.50,"\'+box"');
    expect(lines[2]).toBe("Grout,12,bag");
  });

  it("imports its own export back unchanged", () => {
    const csv = Papa.unparse(rows, { escapeFormulae: CSV_FORMULA_CELL });
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true, transform: restoreCsvFormula });
    expect(parsed.data).toEqual(rows);
  });
});
