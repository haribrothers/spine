import { describe, expect, it } from "vitest";
import { filterJobs, jobStats, parseJobsState } from "../app/(app)/jobs/jobs-list-state";
import { job } from "./job-fixtures";

describe("US-JOB-31 · see active, ready-to-bill, over-budget jobs and retention at a glance", () => {
  const jobs = [
    job({ id: "a", status: "active", contractValueAmount: "18500000", readyToBillCount: 1, readyToBillAmount: "2720000", retentionHeld: "102000", budgetState: "near" }),
    job({ id: "b", status: "active", contractValueAmount: "500000", currency: "USD", readyToBillCount: 0, readyToBillAmount: "0", retentionHeld: "0", budgetState: "ok" }),
    job({ id: "c", status: "completed", contractValueAmount: "4200000", readyToBillCount: 0, readyToBillAmount: "0", retentionHeld: "420000", budgetState: "over" }),
    job({ id: "d", status: "on_hold", contractValueAmount: "224790", readyToBillCount: 2, readyToBillAmount: "50000", retentionHeld: "0", budgetState: "none" }),
  ];

  it("Active counts active jobs with their contract value; other currencies are noted, not added", () => {
    expect(jobStats(jobs, "INR", true).active).toEqual({ count: 2, amount: 18500000n, otherCurrencies: true });
  });

  it("Ready to bill counts jobs with a completed, not invoiced milestone, with that amount", () => {
    expect(jobStats(jobs, "INR", true).ready).toEqual({ count: 2, amount: 2770000n, otherCurrencies: false });
  });

  it("Over or near budget shows only with the job-profitability right", () => {
    expect(jobStats(jobs, "INR", true).budget).toBe(2);
    expect(jobStats(jobs, "INR", false).budget).toBeNull();
  });

  it("Retention held totals what's held on 1150, across the jobs holding it", () => {
    expect(jobStats(jobs, "INR", true).retention).toEqual({ count: 2, amount: 522000n, otherCurrencies: false });
  });

  it("the first three cards filter the list", () => {
    const ids = (card: string) => filterJobs(jobs, parseJobsState(new URLSearchParams(`card=${card}`))).map((j) => j.id);
    expect(ids("active")).toEqual(["a", "b"]);
    expect(ids("ready")).toEqual(["a", "d"]);
    expect(ids("budget")).toEqual(["a", "c"]);
    expect(parseJobsState(new URLSearchParams("card=retention")).card).toBe("");
  });
});
