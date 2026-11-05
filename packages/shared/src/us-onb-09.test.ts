import { describe, expect, it } from "vitest";
import { buildDemoPlan } from "./demo/build.ts";
import { DEMO_COUNTRIES, DEMO_INDUSTRIES } from "./demo/types.ts";

/** US-ONB-09 (finding C5) — every demo business has one recurring meeting: its internal planning meeting, weekly for three months. */
describe("US-ONB-09", () => {
  it.each(DEMO_COUNTRIES.flatMap((country) => DEMO_INDUSTRIES.map((industry) => [country, industry] as const)))("%s %s has one weekly internal meeting", (country, industry) => {
    const weekly = buildDemoPlan(country, industry).meetings.filter((m) => m.weeklyFor);
    expect(weekly).toHaveLength(1);
    expect(weekly[0]).toMatchObject({ contact: null, weeklyFor: 12 });
    expect(weekly[0]!.startInDays).toBeGreaterThan(0);
  });
});
