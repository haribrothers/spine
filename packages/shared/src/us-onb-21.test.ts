import { describe, expect, it } from "vitest";
import { buildDemoPlan } from "./demo/build.ts";
import { niceAmount } from "./demo/scenario.ts";
import { DEMO_INDUSTRIES, type DemoCountry } from "./demo/types.ts";
import { taxPreset } from "./tax/presets/index.ts";

/** US-ONB-21 (D-192) — the UK, Australia, New Zealand, UAE and Saudi demos are local, in local money and tax. */
describe("US-ONB-21", () => {
  const countries: [DemoCountry, string][] = [
    ["GB", "GBP"],
    ["AU", "AUD"],
    ["NZ", "NZD"],
    ["AE", "AED"],
    ["SA", "SAR"],
  ];

  it.each(countries)("%s demos are in %s, with local contacts and the preset's rates", (country, currency) => {
    const preset = taxPreset(country as Exclude<typeof country, "US" | "IN">)!;
    const rateNames = new Set(preset.rates.map((r) => r.name));
    for (const industry of DEMO_INDUSTRIES) {
      const plan = buildDemoPlan(country, industry);
      expect(plan.currency.code).toBe(currency);
      expect(plan.taxCountry).toBe(country);
      expect(plan.ownTaxRates).toEqual([]);
      const local = plan.contacts.filter((c) => c.key !== "overseas");
      expect(local.every((c) => c.address.country === country), industry).toBe(true);
      const taxes = [...plan.items.map((i) => i.tax), ...plan.bills.flatMap((b) => b.lines.map((l) => l.tax))];
      for (const tax of taxes) if (tax?.intra?.rate) expect(rateNames, tax.intra.rate).toContain(tax.intra.rate);
      // A zero-rated, exempt or outside-the-scope line wherever the industry has one.
      const lineTaxes = plan.invoices.flatMap((i) => i.lines.map((l) => ("tax" in l && l.tax ? l.tax : "item" in l ? plan.items.find((it) => it.key === l.item)!.tax : null)));
      const untaxed = lineTaxes.some((t) => t && (t.intra === null || /0%|free|Exempt/.test(t.intra.rate ?? "")));
      if (["interior_design", "it_services", "professional_services"].includes(industry) || (country === "GB" && industry === "construction")) expect(untaxed, `${country} ${industry}`).toBe(true);
    }
  });

  it("prices at local levels, rounded to sensible amounts", () => {
    expect(niceAmount(65 * 0.8)).toBe(52);
    expect(niceAmount(1.2 * 3.67)).toBe(4.5);
    expect(niceAmount(450 * 1.65)).toBe(745);
    expect(niceAmount(2500 * 3.75)).toBe(9380);
    expect(niceAmount(18000 * 3.67)).toBe(66050);
    const uk = buildDemoPlan("GB", "trades");
    expect(uk.items.find((i) => i.key === "electrician")!.price).toBe(6800n);
    expect(buildDemoPlan("SA", "trades").items.find((i) => i.key === "electrician")!.price).toBe(32000n);
  });

  it("uses the UK's reduced rate for mobility aids and zero rate for new homes", () => {
    expect(buildDemoPlan("GB", "trades").items.find((i) => i.key === "mobility")!.tax.intra).toEqual({ rate: "VAT 5%" });
    expect(buildDemoPlan("GB", "construction").items.find((i) => i.key === "newbuild")!.tax.intra).toEqual({ rate: "VAT 0%" });
    expect(buildDemoPlan("AU", "trades").items.find((i) => i.key === "mobility")!.tax.intra).toEqual({ rate: "GST 10%" });
  });

  it("carries the expense's tax inside its amount", () => {
    const plan = buildDemoPlan("GB", "it_services");
    const e = plan.expenses[0]!;
    // £190 including 20% VAT: £31.67 VAT.
    expect(e.amount).toBe(19000n);
    expect(e.tax).toEqual({ rate: { rate: "VAT 20%" }, amount: 3167n });
  });
});
