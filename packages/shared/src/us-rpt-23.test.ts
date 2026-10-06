import { describe, expect, it } from "vitest";
import { REPORTS, REPORT_GROUPS, canOpenReport, matchesReportSearch } from "./schemas/reports-catalog.ts";

describe("US-RPT-23", () => {
  it("every report belongs to a known group and has a unique slug", () => {
    expect(new Set(REPORTS.map((r) => r.slug)).size).toBe(REPORTS.length);
    for (const r of REPORTS) expect(REPORT_GROUPS).toContain(r.group);
  });

  it("owners open everything; Staff only what their rights allow; Field nothing", () => {
    const pl = REPORTS.find((r) => r.slug === "profit-and-loss")!;
    const jobs = REPORTS.find((r) => r.slug === "job-profitability")!;
    const journals = REPORTS.find((r) => r.slug === "journals")!;
    expect(canOpenReport(pl, "owner", {})).toBe(true);
    expect(canOpenReport(pl, "staff", { "reports.view_job_profitability": true })).toBe(false);
    expect(canOpenReport(jobs, "staff", { "reports.view_job_profitability": true })).toBe(true);
    expect(canOpenReport(journals, "staff", { "ledger.view": true })).toBe(true);
    expect(canOpenReport(jobs, "field", { "reports.view_job_profitability": true })).toBe(false);
  });

  it("search matches names and keywords, ignoring case", () => {
    expect(REPORTS.filter((r) => matchesReportSearch(r, "LEDGER")).map((r) => r.slug)).toEqual(expect.arrayContaining(["journals", "trial-balance"]));
    expect(REPORTS.filter((r) => matchesReportSearch(r, "zzz"))).toEqual([]);
    expect(REPORTS.filter((r) => matchesReportSearch(r, "")).length).toBe(REPORTS.length);
  });
});
