import { describe, expect, it } from "vitest";
import { GENERAL_TAX_TYPES, INDIA_TAX_TYPES, TAX_TYPE_LABELS, gstGroupScope } from "./tax-types.ts";
import { createTaxGroupSchema, createTaxRateSchema } from "../schemas/tax.ts";

describe("US-TAX-10 · give each rate a tax type", () => {
  it("offers CGST, SGST, UTGST, IGST and Cess for India, and VAT, GST, Sales tax or Other elsewhere", () => {
    expect(INDIA_TAX_TYPES.map((t) => TAX_TYPE_LABELS[t])).toEqual(["CGST", "SGST", "UTGST", "IGST", "Cess"]);
    expect(GENERAL_TAX_TYPES.map((t) => TAX_TYPE_LABELS[t])).toEqual(["VAT", "GST", "Sales tax", "Other"]);
  });

  it("accepts a tax type on a rate and a scope on a group", () => {
    expect(createTaxRateSchema.parse({ name: "CGST 9%", rate: 9, taxType: "cgst" }).taxType).toBe("cgst");
    expect(createTaxRateSchema.safeParse({ name: "X", rate: 9, taxType: "luxury" }).success).toBe(false);
    expect(createTaxGroupSchema.parse({ name: "GST 18%", taxRateIds: ["8a7d7a3c-3f0e-4c55-9a43-3b9a0a6b1c11"], scope: "intra" }).scope).toBe("intra");
  });

  describe("a GST group", () => {
    const cgst = (rate: number) => ({ taxType: "cgst" as const, rate });
    const sgst = (rate: number) => ({ taxType: "sgst" as const, rate });
    const utgst = (rate: number) => ({ taxType: "utgst" as const, rate });
    const igst = (rate: number) => ({ taxType: "igst" as const, rate });
    const cess = (rate: number) => ({ taxType: "cess" as const, rate });

    it("is CGST with SGST or UTGST at the same rate, optionally with cess (intra-state)", () => {
      expect(gstGroupScope([cgst(9), sgst(9)])).toBe("intra");
      expect(gstGroupScope([cgst(2.5), utgst(2.5)])).toBe("intra");
      expect(gstGroupScope([cgst(14), sgst(14), cess(12)])).toBe("intra");
      expect(gstGroupScope([cgst("0.125" as unknown as number), sgst(0.125)])).toBe("intra");
    });

    it("or a single IGST rate, optionally with cess (inter-state)", () => {
      expect(gstGroupScope([igst(18)])).toBe("inter");
      expect(gstGroupScope([igst(28), cess(12)])).toBe("inter");
    });

    it("refuses any other mix", () => {
      expect(gstGroupScope([cgst(9), sgst(6)])).toBeNull();
      expect(gstGroupScope([cgst(9)])).toBeNull();
      expect(gstGroupScope([cgst(9), sgst(9), utgst(9)])).toBeNull();
      expect(gstGroupScope([cgst(9), sgst(9), igst(18)])).toBeNull();
      expect(gstGroupScope([igst(18), igst(5)])).toBeNull();
      expect(gstGroupScope([cgst(9), sgst(9), cess(1), cess(2)])).toBeNull();
      expect(gstGroupScope([cgst(9), { taxType: "other", rate: 9 }])).toBeNull();
      expect(gstGroupScope([cess(12)])).toBeNull();
      expect(gstGroupScope([])).toBeNull();
    });
  });
});
