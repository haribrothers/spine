import { describe, expect, it } from "vitest";
import { buildDemoPlan } from "./demo/build.ts";
import { DEMO_COUNTRIES, DEMO_INDUSTRIES, type DemoPlan } from "./demo/types.ts";

const plans: [string, DemoPlan][] = DEMO_COUNTRIES.flatMap((country) => DEMO_INDUSTRIES.map((industry): [string, DemoPlan] => [`${country} ${industry}`, buildDemoPlan(country, industry)]));

/** US-ONB-24 to US-ONB-27 (D-216) — every demo plan, Riverstone included, carries what the refined screens show. */
describe.each(plans)("%s", (_name, plan) => {
  const leads = plan.contacts.flatMap((c) => [c.lead, c.lostLead].filter((l) => l !== undefined));
  const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");

  it("US-ONB-24 · open leads shared between the owner and Staff, aged, with close dates; one cold; one lost on price", () => {
    expect(new Set(open.map((l) => l.owner))).toEqual(new Set(["owner", "staff"]));
    expect(leads.filter((l) => l.stage === "won" || l.stage === "lost").every((l) => l.owner === "owner")).toBe(true);
    expect(new Set(open.map((l) => l.daysInStage)).size).toBeGreaterThan(1);
    expect(open.every((l) => (l.expectedCloseInDays ?? 0) > 0 && (l.expectedCloseInDays ?? 0) <= 60)).toBe(true);
    expect(open.filter((l) => l.cold)).toHaveLength(1);
    expect(open.find((l) => l.cold)!.daysInStage).toBeGreaterThanOrEqual(14);
    expect(leads.filter((l) => l.lostReason === "price")).toHaveLength(1);
    expect(leads.some((l) => l.stage === "won" && (l.daysInStage ?? 99) <= 30)).toBe(true);
  });

  it("US-ONB-25 · titled quotes, sent on different days, expiring, expired, viewed, accepted this month and declined", () => {
    expect(plan.quotes.every((q) => q.title.trim())).toBe(true);
    const sent = plan.quotes.filter((q) => q.outcome !== "draft");
    expect(new Set(sent.map((q) => q.sentInDays)).size).toBeGreaterThan(2);
    expect(sent.some((q) => q.outcome === "sent" && q.validUntilInDays >= 0 && q.validUntilInDays <= 7)).toBe(true);
    expect(sent.some((q) => q.outcome === "sent" && q.validUntilInDays < 0)).toBe(true);
    expect(sent.some((q) => (q.views?.count ?? 0) >= 2)).toBe(true);
    expect(plan.quotes.filter((q) => q.outcome === "accepted" && q.thisMonth)).toHaveLength(1);
    expect(plan.quotes.filter((q) => q.outcome === "declined")).toHaveLength(1);
    // The declined quote is the lost lead's.
    const declined = plan.quotes.find((q) => q.outcome === "declined")!;
    const contact = plan.contacts.find((c) => c.key === declined.contact)!;
    expect([contact.lead, contact.lostLead].some((l) => l?.stage === "lost")).toBe(true);
    // Every quote's answer comes after it went out.
    for (const q of sent) if (q.respondedInDays !== undefined) expect(q.respondedInDays).toBeGreaterThan(q.sentInDays!);
  });

  it("US-ONB-26 · jobs with end dates and budgets; one from a quote, one ready to bill, one finished", () => {
    if (!plan.jobs.length) return;
    expect(plan.jobs.every((j) => j.endInDays > j.startInDays && j.budget !== undefined)).toBe(true);
    expect(plan.jobs.filter((j) => j.fromQuote)).toHaveLength(1);
    expect(plan.jobs.filter((j) => j.budget === "near")).toHaveLength(1);
    expect(plan.jobs.filter((j) => j.completed && j.endInDays < 0)).toHaveLength(1);
    expect(plan.jobs.filter((j) => j.milestones.some((m) => m.completeInDays !== undefined && m.invoiceInDays === undefined))).toHaveLength(1);
    expect(plan.jobs.filter((j) => j.percentComplete !== undefined)).toHaveLength(1);
  });

  it("US-ONB-27 · goods and services, two bundles of real items, meetings at different times with three in the next two weeks", () => {
    expect(plan.items.every((i) => i.income === "goods" || i.income === "services")).toBe(true);
    // A professional practice sells no goods.
    expect(plan.items.some((i) => i.income === "goods")).toBe(plan.industry !== "professional_services");
    expect(plan.bundles).toHaveLength(2);
    const keys = new Set(plan.items.map((i) => i.key));
    for (const bundle of plan.bundles) for (const [key, quantity] of bundle.items) expect(keys.has(key) && quantity > 0).toBe(true);
    expect(new Set(plan.meetings.map((m) => m.startTime)).size).toBeGreaterThanOrEqual(3);
    expect(plan.meetings.filter((m) => m.startInDays >= 1 && m.startInDays <= 14).length).toBeGreaterThanOrEqual(3);
    expect(plan.meetings.some((m) => m.startInDays === 1)).toBe(true);
  });
});
