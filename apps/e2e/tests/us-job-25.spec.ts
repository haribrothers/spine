import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

async function jobWithCost(page: Page) {
  const jobs = (await (await page.request.get(`${API_URL}/jobs`)).json()) as { id: string; name: string }[];
  for (const job of jobs) {
    const costing = (await (await page.request.get(`${API_URL}/jobs/${job.id}/costing`)).json()) as { cost: string };
    if (BigInt(costing.cost) > 0n) return { ...job, cost: BigInt(costing.cost) };
  }
  throw new Error("the demo data has a job with cost");
}

const setBudget = (page: Page, id: string, amount: bigint | null) =>
  page.request.put(`${API_URL}/jobs/${id}`, { headers: { "Idempotency-Key": randomUUID() }, data: { costBudgetAmount: amount === null ? null : amount.toString() } });

test.describe("US-JOB-25", () => {
  test("the Budget card shows used, nearing and over states, and 'No budget set' with 'Set a budget'", async ({ page, seededOrg: _ }) => {
    const job = await jobWithCost(page);
    const costing = page.getByRole("tab", { name: "Costing" });

    await setBudget(page, job.id, job.cost * 2n);
    await page.goto(`/jobs/${job.id}`);
    await costing.click();
    await expect(page.getByText("50% of budget used")).toBeVisible();
    await expect(page.getByText("Warning at 80% · over at 100%")).toBeVisible();

    await setBudget(page, job.id, (job.cost * 100n) / 85n);
    await page.reload();
    await costing.click();
    await expect(page.getByText(/^Nearing budget — 8\d% used$/)).toBeVisible();

    await setBudget(page, job.id, job.cost - 100n);
    await page.reload();
    await costing.click();
    await expect(page.getByText("Over budget by $1.00")).toBeVisible();

    // The Jobs list says the same in words.
    await page.goto("/jobs");
    await expect(page.getByRole("row").filter({ hasText: job.name }).first()).toContainText(/Over · \d+%/);

    await setBudget(page, job.id, null);
    await page.goto(`/jobs/${job.id}`);
    await costing.click();
    await expect(page.getByText("No budget set")).toBeVisible();
    await page.getByRole("button", { name: "Set a budget" }).click();
    await expect(page.getByRole("dialog", { name: "Edit job" }).getByRole("textbox", { name: "Cost budget" })).toBeVisible();
  });
});
