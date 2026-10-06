import { describe, expect, it } from "vitest";
import { guessStatementMapping, parseStatementAmount, parseStatementDate, statementDedupeKey, statementImportSummary, statementMappingSchema } from "./schemas/bank-statements.ts";

describe("US-BANK-07", () => {
  it("reads dates in each format, and refuses impossible ones", () => {
    expect(parseStatementDate("01/10/2026", "DD/MM/YYYY")).toBe("2026-10-01");
    expect(parseStatementDate("10/01/2026", "MM/DD/YYYY")).toBe("2026-10-01");
    expect(parseStatementDate("2026-10-01", "YYYY-MM-DD")).toBe("2026-10-01");
    expect(parseStatementDate("01 Oct 2026", "DD MMM YYYY")).toBe("2026-10-01");
    expect(parseStatementDate("1-10-26", "DD/MM/YYYY")).toBe("2026-10-01");
    expect(parseStatementDate("31/02/2026", "DD/MM/YYYY")).toBeNull();
    expect(parseStatementDate("soon", "DD/MM/YYYY")).toBeNull();
    expect(parseStatementDate("", "DD/MM/YYYY")).toBeNull();
  });

  it("reads amounts with symbols, separators, minus signs, brackets and CR/DR", () => {
    expect(parseStatementAmount("4,542.50", "USD")).toBe(454250n);
    expect(parseStatementAmount("$4,542.50", "USD")).toBe(454250n);
    expect(parseStatementAmount("-2,160.00", "USD")).toBe(-216000n);
    expect(parseStatementAmount("−58.20", "USD")).toBe(-5820n);
    expect(parseStatementAmount("(18.00)", "USD")).toBe(-1800n);
    expect(parseStatementAmount("18.00 DR", "USD")).toBe(-1800n);
    expect(parseStatementAmount("6.12 CR", "USD")).toBe(612n);
    expect(parseStatementAmount("₹1,20,247.50", "INR")).toBe(12024750n);
    expect(parseStatementAmount("12.345", "USD")).toBeNull();
    expect(parseStatementAmount("n/a", "USD")).toBeNull();
    expect(parseStatementAmount("", "USD")).toBeNull();
  });

  it("treats the same date, amount and description (ignoring case and spacing) as the same line", () => {
    expect(statementDedupeKey("2026-10-01", 454250n, "NEFT-MAPLE  RIDGE DEV ")).toBe(statementDedupeKey("2026-10-01", 454250n, "neft-maple ridge dev"));
    expect(statementDedupeKey("2026-10-01", 454250n, "A")).not.toBe(statementDedupeKey("2026-10-02", 454250n, "A"));
  });

  it("guesses a mapping from common bank headers", () => {
    const guess = guessStatementMapping(["Txn date", "Narration", "Ref no.", "Withdrawal", "Deposit", "Balance"], [{ "Txn date": "01/10/2026" }]);
    expect(guess).toMatchObject({ date: "Txn date", dateFormat: "DD/MM/YYYY", description: "Narration", reference: "Ref no.", amountMode: "split", moneyIn: "Deposit", moneyOut: "Withdrawal", balance: "Balance" });
    expect(guessStatementMapping(["Date", "Description", "Amount"], [{ Date: "2026-10-01" }])).toMatchObject({ amountMode: "single", amount: "Amount", dateFormat: "YYYY-MM-DD" });
  });

  it("needs the amount column, or both money in and money out", () => {
    expect(statementMappingSchema.safeParse({ date: "Date", dateFormat: "DD/MM/YYYY", description: "D", amountMode: "split", moneyIn: "In" }).success).toBe(false);
    expect(statementMappingSchema.safeParse({ date: "Date", dateFormat: "DD/MM/YYYY", description: "D", amountMode: "single", amount: "Amount" }).success).toBe(true);
  });

  it("summarises an import", () => {
    expect(statementImportSummary({ imported: 3, skipped: 2, failed: [{ row: 5, reason: "x" }] })).toBe("Imported 3 lines · skipped 2 already imported · 1 rows couldn't be read");
  });
});
