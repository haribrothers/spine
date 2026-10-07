import { describe, expect, it } from "vitest";
import { gstGroupScope } from "../tax-types.ts";
import { OTHER_COUNTRY_LABEL, TAX_PRESETS, taxCountryLabel, taxPreset } from "./index.ts";

describe("US-TAX-09 · start with my country's tax rates", () => {
  it("offers India, the UK, Australia, New Zealand, the UAE and Saudi Arabia, then another country", () => {
    expect(TAX_PRESETS.map((p) => p.label)).toEqual([
      "India (GST)",
      "United Kingdom (VAT)",
      "Australia (GST)",
      "New Zealand (GST)",
      "United Arab Emirates (VAT)",
      "Saudi Arabia (VAT)",
    ]);
    expect(taxCountryLabel("other")).toBe(OTHER_COUNTRY_LABEL);
    expect(OTHER_COUNTRY_LABEL).toBe("Another country — I'll add my own rates");
    expect(taxPreset("other")).toBeNull();
  });

  describe("India", () => {
    const india = taxPreset("IN")!;
    const rate = (name: string) => india.rates.find((r) => r.name === name);
    const group = (name: string) => india.groups.find((g) => g.name === name);

    it("creates CGST, SGST and UTGST halves and IGST at 0, 0.25, 3, 5, 12, 18, 28 and 40%", () => {
      for (const slab of [0, 0.25, 3, 5, 12, 18, 28, 40]) {
        expect(rate(`CGST ${slab / 2}%`)).toMatchObject({ rate: slab / 2, taxType: "cgst" });
        expect(rate(`SGST ${slab / 2}%`)).toMatchObject({ rate: slab / 2, taxType: "sgst" });
        expect(rate(`UTGST ${slab / 2}%`)).toMatchObject({ rate: slab / 2, taxType: "utgst" });
        expect(rate(`IGST ${slab}%`)).toMatchObject({ rate: slab, taxType: "igst" });
      }
      expect(india.rates).toHaveLength(32);
      expect(rate("CGST 0.125%")?.rate).toBe(0.125);
    });

    it('groups the halves as "GST 18%" (intra-state), with "IGST 18%" as the inter-state counterpart', () => {
      expect(group("GST 18%")).toMatchObject({ rates: ["CGST 9%", "SGST 9%"], scope: "intra" });
      expect(group("GST 5%")).toMatchObject({ rates: ["CGST 2.5%", "SGST 2.5%"], scope: "intra" });
      expect(group("GST 18% (UT)")).toMatchObject({ rates: ["CGST 9%", "UTGST 9%"], scope: "intra" });
      // Every group is a valid GST mix (US-TAX-10).
      for (const g of india.groups) expect(gstGroupScope(g.rates.map((name) => rate(name)!))).toBe("intra");
    });

    it("creates the 12% and 28% groups archived, as the law no longer uses them", () => {
      for (const slab of [12, 28]) {
        expect(group(`GST ${slab}%`)?.archived).toBe(true);
        expect(rate(`IGST ${slab}%`)?.archived).toBe(true);
      }
      for (const slab of [0, 0.25, 3, 5, 18, 40]) {
        expect(group(`GST ${slab}%`)?.archived).toBeFalsy();
        expect(rate(`IGST ${slab}%`)?.archived).toBeFalsy();
      }
    });

    it("keeps the union-territory groups archived until they're needed, and sets no invoice title", () => {
      expect(india.groups.filter((g) => g.name.endsWith("(UT)")).every((g) => g.archived)).toBe(true);
      expect(india.invoiceTitle).toBeUndefined();
    });
  });

  it('gives the UK "VAT 20%", "VAT 5%", "VAT 0%" and "Exempt", titled "VAT invoice"', () => {
    const uk = taxPreset("GB")!;
    expect(uk.rates.map((r) => [r.name, r.rate, r.taxType])).toEqual([
      ["VAT 20%", 20, "vat"],
      ["VAT 5%", 5, "vat"],
      ["VAT 0%", 0, "vat"],
      ["Exempt", 0, "vat"],
    ]);
    expect(uk.invoiceTitle).toBe("VAT invoice");
  });

  it.each([
    ["AU", 10, "gst"],
    ["NZ", 15, "gst"],
    ["AE", 5, "vat"],
    ["SA", 15, "vat"],
  ] as const)("gives %s its standard rate (%s%%), a zero rate and exempt, titled \"Tax invoice\"", (country, standard, taxType) => {
    const preset = taxPreset(country)!;
    expect(preset.rates[0]).toMatchObject({ rate: standard, taxType });
    expect(preset.rates.filter((r) => r.rate === 0)).toHaveLength(2);
    expect(preset.rates.some((r) => r.name === "Exempt")).toBe(true);
    expect(preset.invoiceTitle).toBe("Tax invoice");
  });

  it("names every rate once per country", () => {
    for (const preset of TAX_PRESETS) expect(new Set(preset.rates.map((r) => r.name)).size).toBe(preset.rates.length);
  });
});
