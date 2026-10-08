import { describe, expect, it } from "vitest";
import { buildDemoPlan } from "./demo/build.ts";
import { DEMO_INDUSTRIES, type DemoPlan, type DemoPlanLine } from "./demo/types.ts";
import { gstinStateCode, isValidGstin, isValidHsnSac } from "./tax/gst.ts";
import { INDIA_PRESET } from "./tax/presets/india.ts";
import { UPI_ID_PATTERN } from "./schemas/business-profile.ts";

/** US-ONB-19 (D-192) — India's demo businesses show every GST case. */
describe("US-ONB-19", () => {
  const plans = DEMO_INDUSTRIES.map((industry) => buildDemoPlan("IN", industry));
  const subtotal = (plan: DemoPlan, lines: DemoPlanLine[]) =>
    lines.reduce((sum, line) => {
      if ("item" in line) return sum + plan.items.find((i) => i.key === line.item)!.price * BigInt(line.quantity);
      return sum + line.price * BigInt(line.quantity);
    }, 0n);

  it.each(plans.map((p) => [p.industry, p] as [string, DemoPlan]))("%s is a Bengaluru business registered for GST", (_name, plan) => {
    expect(plan.currency).toEqual({ code: "INR", locale: "en-IN" });
    expect(plan.financialYearStart).toEqual({ month: 4, day: 1 });
    expect(plan.taxCountry).toBe("IN");
    expect(plan.gstRegistration).toMatchObject({ stateCode: "29", returnPeriod: "monthly", exportUnderLut: true });
    expect(isValidGstin(plan.gstRegistration!.registrationNumber)).toBe(true);
    expect(gstinStateCode(plan.gstRegistration!.registrationNumber)).toBe("29");
    expect(plan.business.address).toContain("Bengaluru, Karnataka 560025");
    expect(plan.business.upiId).toMatch(UPI_ID_PATTERN);
    expect(plan.business.upiId).toMatch(/@example$/);
  });

  it.each(plans.map((p) => [p.industry, p] as [string, DemoPlan]))("%s has contacts for every GST case, each registered one with a valid GSTIN for its state", (_name, plan) => {
    const customers = plan.contacts.filter((c) => c.type === "customer");
    const treatments = customers.map((c) => `${c.gstTreatment}:${c.stateCode ?? "-"}`);
    expect(treatments).toEqual(expect.arrayContaining(["registered:29", "registered:27", "consumer:29", "consumer:33", "sez:29"]));
    if (["interior_design", "it_services", "professional_services"].includes(plan.industry)) expect(treatments).toContain("overseas:-");
    for (const c of plan.contacts) {
      if (c.gstTreatment === "registered" || c.gstTreatment === "sez") {
        expect(isValidGstin(c.taxId!), c.name).toBe(true);
        expect(gstinStateCode(c.taxId!)).toBe(c.stateCode);
      }
      if (c.gstTreatment !== "overseas") expect(c.address.stateCode, c.name).toBe(c.stateCode);
    }
    const vendors = plan.contacts.filter((c) => c.type !== "customer");
    expect(vendors.map((v) => v.gstTreatment)).toEqual(expect.arrayContaining(["registered", "unregistered"]));
    expect(vendors.some((v) => v.gstTreatment === "registered" && v.stateCode !== "29")).toBe(true);
  });

  it.each(plans.map((p) => [p.industry, p] as [string, DemoPlan]))("%s gives every item an HSN or SAC code and the current slab's GST group and IGST rate", (_name, plan) => {
    const rates = new Set(INDIA_PRESET.rates.filter((r) => !r.archived).map((r) => r.name));
    const groups = new Set(INDIA_PRESET.groups.filter((g) => !g.archived).map((g) => g.name));
    const typed = [...plan.bills.flatMap((b) => b.lines), ...(plan.variationOrder?.lines ?? [])];
    for (const item of [...plan.items, ...typed]) {
      const name = "key" in item ? item.key : item.name;
      if (item.tax?.intra) {
        expect(isValidHsnSac(item.hsnSac ?? ""), name).toBe(true);
        expect(groups, name).toContain(item.tax.intra.group);
        expect(rates, name).toContain(item.tax.inter?.rate);
      }
    }
    for (const job of plan.jobs) expect(isValidHsnSac(job.milestoneTax!.hsnSac!)).toBe(true);
  });

  it.each(plans.map((p) => [p.industry, p] as [string, DemoPlan]))("%s has a B2C large invoice and recent B2B, SEZ and export invoices for GSTR-1", (_name, plan) => {
    const contact = (key: string) => plan.contacts.find((c) => c.key === key)!;
    const recent = plan.invoices.filter((i) => i.outcome === "issued" && i.issueInDays !== null && i.issueInDays >= -28);
    // Within 28 days, so they're in this month's or last month's GSTR-1 whatever today is.
    const large = recent.find((i) => contact(i.contact).gstTreatment === "consumer" && contact(i.contact).stateCode !== "29");
    expect(large).toBeDefined();
    expect((subtotal(plan, large!.lines) * 118n) / 100n).toBeGreaterThan(10000000n);
    expect(recent.some((i) => contact(i.contact).gstTreatment === "registered")).toBe(true);
    expect(recent.some((i) => contact(i.contact).gstTreatment === "consumer" && contact(i.contact).stateCode === "29")).toBe(true);
    expect(recent.some((i) => contact(i.contact).gstTreatment === "sez" && i.zeroRated)).toBe(true);
    expect(plan.invoices.some((i) => contact(i.contact).gstTreatment === "sez" && !i.zeroRated && i.outcome === "issued")).toBe(true);
    if (["interior_design", "it_services", "professional_services"].includes(plan.industry)) expect(recent.some((i) => contact(i.contact).gstTreatment === "overseas")).toBe(true);
    const credited = plan.invoices.find((i) => i.key === plan.creditNotes[0]!.invoice)!;
    expect(contact(credited.contact).gstTreatment).toBe("registered");
  });

  it("charges no tax on the unregistered vendor's bills", () => {
    for (const plan of plans) {
      const local = plan.contacts.find((c) => c.gstTreatment === "unregistered")!;
      for (const bill of plan.bills.filter((b) => b.contact === local.key)) for (const line of bill.lines) expect(line.tax?.intra ?? null).toBeNull();
    }
  });
});
