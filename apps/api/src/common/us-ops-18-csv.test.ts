import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

/**
 * US-OPS-18 (security review) — CSV exports never hand a spreadsheet a
 * formula. Every CSV the API writes (reports, the tax summary, the audit log,
 * the data export) goes through `toCsv`; the rule itself is tested in
 * `@spine/shared` (`us-ops-18.test.ts`).
 */
describe("US-OPS-18 · API CSV exports can't carry a formula", () => {
  it("guards a customer's signer name in an exported row and keeps amounts numeric", () => {
    const csv = toCsv(["signer_name", "amount"], [["=cmd|' /C calc'!A0", "-120.00"], ["Ann Lee", -5], ["@SUM(A1:A9)", 0]]);
    expect(csv.split("\r\n")).toEqual(["signer_name,amount", "'=cmd|' /C calc'!A0,-120.00", "Ann Lee,-5", "'@SUM(A1:A9),0"]);
  });

  it("still quotes a guarded cell that holds a comma or a quote", () => {
    expect(toCsv(["x"], [['=A1,"B"']])).toBe('x\r\n"\'=A1,""B"""');
  });

  it("quotes a cell holding a bare carriage return", () => {
    expect(toCsv(["x"], [["a\rb"]])).toBe('x\r\n"a\rb"');
  });
});
