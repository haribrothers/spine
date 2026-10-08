import { describe, expect, it } from "vitest";
import { buildDemoPlan, demoBusinessName, guessDemoCountry } from "./demo/build.ts";
import { DEMO_COUNTRIES, DEMO_COUNTRY_LABELS, DEMO_INDUSTRIES, demoCountryFor, type DemoPlan } from "./demo/types.ts";
import { INDUSTRY_TEMPLATES } from "./schemas/industry-template.ts";

/** US-ONB-18 (D-192) — every country and industry builds a complete, consistent demo business. */
describe("US-ONB-18", () => {
  const all = DEMO_COUNTRIES.flatMap((country) => DEMO_INDUSTRIES.map((industry) => ({ country, industry, plan: buildDemoPlan(country, industry) })));

  it("offers seven countries and five industries, with labels", () => {
    expect(DEMO_COUNTRIES.map((c) => DEMO_COUNTRY_LABELS[c])).toEqual([
      "United States (sales tax)",
      "India (GST)",
      "United Kingdom (VAT)",
      "Australia (GST)",
      "New Zealand (GST)",
      "United Arab Emirates (VAT)",
      "Saudi Arabia (VAT)",
    ]);
    expect(DEMO_INDUSTRIES.map((i) => INDUSTRY_TEMPLATES[i].label)).toEqual(["Construction / Contracting", "Interior design & fit-out", "Trades (electrical, plumbing, HVAC)", "IT services & agency", "Professional services"]);
  });

  it("keeps US construction as Riverstone Builders, unchanged", () => {
    const plan = buildDemoPlan("US", "construction");
    expect(plan.business.name).toBe("Riverstone Builders");
    expect(plan.ordering).toBe("declared");
    expect(plan.contacts).toHaveLength(14);
    expect(plan.items).toHaveLength(15);
    expect(plan.invoices.map((i) => i.outcome)).toEqual(["issued", "issued", "issued", "draft", "voided"]);
    expect(plan.jobs.map((j) => j.name)).toEqual(["Marina office fit-out", "Phase 2 townhomes — foundations", "Hotel lobby renovation"]);
  });

  it.each(all.map(({ country, industry, plan }) => [`${country} ${industry}`, plan] as [string, DemoPlan]))("%s refers only to its own contacts, items, jobs and categories", (_name, plan) => {
    const contacts = new Set(plan.contacts.map((c) => c.key));
    const items = new Set(plan.items.map((i) => i.key));
    const jobs = new Set(plan.jobs.map((j) => j.key));
    expect(contacts.size).toBe(plan.contacts.length);
    expect(items.size).toBe(plan.items.length);
    const lines = [...plan.quotes.flatMap((q) => q.lines), ...plan.invoices.flatMap((i) => i.lines)];
    for (const line of lines) if ("item" in line) expect(items, line.item).toContain(line.item);
    for (const doc of [...plan.quotes, ...plan.invoices, ...plan.jobs, ...plan.bills]) expect(contacts, doc.contact).toContain(doc.contact);
    for (const doc of [...plan.bills, ...plan.expenses]) if (doc.job) expect(jobs).toContain(doc.job);
    for (const m of plan.meetings) if (m.contact) expect(contacts).toContain(m.contact);
    const categories = INDUSTRY_TEMPLATES[plan.template].categories.map((c) => c.name);
    for (const e of plan.expenses) expect(categories).toContain(e.category);
    for (const c of plan.creditNotes) expect(plan.invoices.find((i) => i.key === c.invoice)?.outcome).toBe("issued");
    expect(plan.business.name).toBe(demoBusinessName(plan.country, plan.industry));
    for (const item of plan.items) expect(item.price).toBeGreaterThan(0n);
  });

  it.each(all.filter((p) => p.plan.ordering === "dated").map(({ country, industry, plan }) => [`${country} ${industry}`, plan] as [string, DemoPlan]))("%s has about six months of history ending today", (_name, plan) => {
    const issued = plan.invoices.filter((i) => i.outcome !== "draft");
    const days = issued.map((i) => i.issueInDays!);
    expect(Math.min(...days)).toBeGreaterThanOrEqual(-185);
    expect(Math.min(...days)).toBeLessThanOrEqual(-150);
    expect(Math.max(...days)).toBeLessThanOrEqual(0);
    // Paid after it was issued, and at least one overdue and unpaid.
    for (const i of issued) for (const p of i.payments ?? []) expect(p.inDays!).toBeGreaterThanOrEqual(i.issueInDays!);
    expect(issued.some((i) => i.outcome === "issued" && i.dueInDays < 0 && !i.payments)).toBe(true);
    expect(plan.invoices.some((i) => i.outcome === "draft")).toBe(true);
    expect(plan.invoices.some((i) => i.outcome === "voided")).toBe(true);
    expect(new Set(plan.quotes.map((q) => q.outcome))).toEqual(new Set(["draft", "sent", "revised"]));
    expect(plan.expenses.map((e) => e.outcome)).toEqual(expect.arrayContaining(["approved", "submitted", "rejected"]));
    expect(plan.contacts.every((c) => c.type !== "customer" || c.lead)).toBe(true);
  });

  it("starts jobs only where the template has them, and releases retention only on construction and fit-out outside India", () => {
    for (const { industry, plan } of all.filter((p) => p.plan.ordering === "dated")) {
      expect(plan.jobs.length, industry).toBe(industry === "professional_services" ? 0 : 3);
      expect(plan.jobs.some((j) => j.releaseRetention), `${plan.country} ${industry}`).toBe(plan.country !== "IN" && (industry === "construction" || industry === "interior_design"));
    }
  });

  it("uses the business's tax country for demos, and guesses a country from the time zone", () => {
    expect(demoCountryFor("IN")).toBe("IN");
    expect(demoCountryFor("other")).toBe("US");
    expect(demoCountryFor(null)).toBe("US");
    expect(guessDemoCountry("Asia/Kolkata")).toBe("IN");
    expect(guessDemoCountry("Asia/Calcutta")).toBe("IN");
    expect(guessDemoCountry("Europe/London")).toBe("GB");
    expect(guessDemoCountry("Australia/Sydney")).toBe("AU");
    expect(guessDemoCountry("Pacific/Auckland")).toBe("NZ");
    expect(guessDemoCountry("Asia/Dubai")).toBe("AE");
    expect(guessDemoCountry("Asia/Riyadh")).toBe("SA");
    expect(guessDemoCountry("America/Chicago")).toBe("US");
    expect(guessDemoCountry("Europe/Paris")).toBe("US");
    expect(guessDemoCountry(undefined)).toBe("US");
  });
});
