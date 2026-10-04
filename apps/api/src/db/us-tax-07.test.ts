import { getTableColumns, isTable } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

describe("US-TAX-07", () => {
  it("no column is stored as floating point (real or double precision)", () => {
    const floats: string[] = [];
    let tables = 0;
    for (const [name, value] of Object.entries(schema)) {
      if (!isTable(value)) continue;
      tables++;
      for (const [column, def] of Object.entries(getTableColumns(value))) {
        if (def.columnType === "PgReal" || def.columnType === "PgDoublePrecision") floats.push(`${name}.${column}`);
      }
    }
    expect(tables).toBeGreaterThan(40);
    expect(floats).toEqual([]);
  });

  it("stores rates, quantities and percentages as numeric(18,4)", () => {
    const expected: [string, string][] = [
      ["taxRates", "rate"],
      ["quoteLines", "quantity"],
      ["quoteLines", "discountPercentage"],
      ["quoteLines", "taxRatePercentage"],
      ["invoiceLines", "quantity"],
      ["invoiceLines", "discountPercentage"],
      ["invoiceLines", "taxRatePercentage"],
      ["creditNoteLines", "quantity"],
      ["creditNoteLines", "taxRatePercentage"],
      ["vendorBillLines", "quantity"],
      ["vendorBillLines", "taxRatePercentage"],
      ["catalogItems", "defaultTaxRatePercentage"],
      ["jobs", "retentionPct"],
      ["milestones", "amount"],
    ];
    for (const [table, column] of expected) {
      const target = (schema as unknown as Record<string, Parameters<typeof getTableColumns>[0]>)[table]!;
      const def = getTableColumns(target)[column] as unknown as { getSQLType(): string };
      expect(def.getSQLType(), `${table}.${column}`).toBe("numeric(18, 4)");
    }
  });
});
