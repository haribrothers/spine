import { describe, expect, it } from "vitest";
import { EXPORT_COLUMNS, bulkToast, exportFileName, exportRows, interCounterpart, plainPrice } from "../app/(app)/catalog/catalog-list-state";
import type { Account, TaxGroupOption, TaxRateOption } from "../app/(app)/catalog/types";
import { CATALOG_IMPORT_FIELDS } from "@spine/shared";
import { item } from "./catalog-fixtures";

describe("US-CAT-12 · export, and change many at once", () => {
  it("exports Import's columns plus Category, with taxes by name and accounts by code", () => {
    const rates = new Map<string, TaxRateOption>([["r1", { id: "r1", name: "VAT 20%", rate: 20, isCompound: false, archivedAt: null }]]);
    const accounts = new Map<string, Account>([["a1", { id: "a1", orgId: "o", code: "4200", name: "Sales — Materials", type: "income", parentId: null, isSystem: false }]]);
    const rows = exportRows(
      [item({ name: "Tiles", description: "Grey, 60 cm", unit: "box", category: "Materials", defaultPriceAmount: "4050", defaultTaxRateId: "r1", incomeAccountId: "a1" })],
      rates,
      new Map<string, TaxGroupOption>(),
      accounts,
    );
    expect(rows).toEqual([
      { Name: "Tiles", Description: "Grey, 60 cm", Unit: "box", Category: "Materials", Price: "40.50", Tax: "VAT 20%", "HSN/SAC code": "", "Income account": "4200", "Expense account": "" },
    ]);
    expect(EXPORT_COLUMNS).toContain("Category");
    expect(CATALOG_IMPORT_FIELDS).toContain("category");
    expect(plainPrice(41000n, "INR")).toBe("410.00");
    expect(plainPrice(1500n, "JPY")).toBe("1500");
    expect(exportFileName(new Date(2026, 9, 3))).toBe("catalogue-2026-10-03.csv");
  });

  it("says how many items a bulk change touched", () => {
    expect(bulkToast("Updated", 3)).toBe("Updated 3 items");
    expect(bulkToast("Archived", 1)).toBe("Archived 1 item");
  });

  it("for a GST business, pairs a GST group with the one active IGST rate at the same total", () => {
    const r = (id: string, rate: number, taxType: string, archivedAt: string | null = null): TaxRateOption => ({ id, name: id, rate, isCompound: false, taxType, archivedAt });
    const gst18: TaxGroupOption = { id: "g18", name: "GST 18%", archivedAt: null, taxRates: [r("CGST 9%", 9, "cgst"), r("SGST 9%", 9, "sgst")] };
    expect(interCounterpart(gst18, [r("IGST 5%", 5, "igst"), r("IGST 18%", 18, "igst")])?.id).toBe("IGST 18%");
    expect(interCounterpart(gst18, [r("IGST 18%", 18, "igst", "2026-01-01T00:00:00Z")])).toBeNull();
    expect(interCounterpart(gst18, [r("IGST 18%", 18, "igst"), r("IGST 18% (old)", 18, "igst")])).toBeNull();
    expect(interCounterpart(gst18, [r("Sales tax 18%", 18, "other")])).toBeNull();
  });
});
