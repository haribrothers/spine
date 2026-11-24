import { describe, expect, it } from "vitest";
import { filterJobs, hasJobFilters, jobContacts, jobsQuery, matchesJobSearch, parseJobsState } from "../app/(app)/jobs/jobs-list-state";
import { job } from "./job-fixtures";

describe("US-JOB-32 · search, filter and come back to the same jobs list", () => {
  it("reads and writes the address, leaving defaults out", () => {
    const state = parseJobsState(new URLSearchParams("q=pune&status=active&status=on_hold,bogus&contact=c1&card=ready&sort=endDate.asc&page=2"));
    expect(state).toEqual({ q: "pune", status: ["active", "on_hold"], contact: "c1", card: "ready", sort: { key: "endDate", direction: "asc" }, page: 2 });
    expect(jobsQuery(state)).toBe("q=pune&status=active&status=on_hold&contact=c1&card=ready&sort=endDate.asc&page=2");
    expect(jobsQuery(parseJobsState(new URLSearchParams("")))).toBe("");
    expect(hasJobFilters(parseJobsState(new URLSearchParams("sort=name.asc")))).toBe(false);
    expect(hasJobFilters(parseJobsState(new URLSearchParams("status=completed")))).toBe(true);
  });

  it("searches number, name, contact and site address", () => {
    const j = job({ number: "JOB-004", name: "Data hall civil works", contactName: "Nimbus Data Systems", siteAddress: "SEZ, Mysuru" });
    for (const q of ["job-004", "data hall", "nimbus", "mysuru"]) expect(matchesJobSearch(j, q)).toBe(true);
    expect(matchesJobSearch(j, "pune")).toBe(false);
  });

  it("filters by status and contact, and offers only contacts with a job", () => {
    const jobs = [job({ id: "a", contactId: "c1", contactName: "Zeta", status: "active" }), job({ id: "b", contactId: "c2", contactName: "Alpha", status: "on_hold" })];
    expect(filterJobs(jobs, parseJobsState(new URLSearchParams("status=on_hold"))).map((j) => j.id)).toEqual(["b"]);
    expect(filterJobs(jobs, parseJobsState(new URLSearchParams("contact=c1"))).map((j) => j.id)).toEqual(["a"]);
    expect(jobContacts(jobs)).toEqual([{ value: "c2", label: "Alpha" }, { value: "c1", label: "Zeta" }]);
  });
});
