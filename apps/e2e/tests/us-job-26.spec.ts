import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

type Costing = { cost: string; byCategory: { code: string; name: string; amount: string; sharePct: number }[] };

async function costings(page: Page) {
  const jobs = (await (await page.request.get(`${API_URL}/jobs`)).json()) as { id: string }[];
  return Promise.all(jobs.map(async (j) => ({ id: j.id, costing: (await (await page.request.get(`${API_URL}/jobs/${j.id}/costing`)).json()) as Costing })));
}

test.describe("US-JOB-26", () => {
  test("Cost by category lists each account with amount and share, totals to Cost, and opens the account drill-down", async ({ page, seededOrg: _ }) => {
    const all = await costings(page);
    const withCost = all.find((j) => j.costing.byCategory.length > 0)!;
    await page.goto(`/jobs/${withCost.id}`);
    await page.getByRole("tab", { name: "Costing" }).click();

    const card = page.getByRole("table", { name: "Cost by category" });
    await expect(page.getByText("From bills and approved expenses tagged to this job")).toBeVisible();
    const first = withCost.costing.byCategory[0]!;
    await expect(card.getByRole("row").filter({ hasText: `${first.code} · ${first.name}` })).toContainText(`${first.sharePct}%`);
    await expect(card.getByRole("row").filter({ hasText: "Total cost" })).toContainText("100%");
    await expect(page.getByRole("img", { name: "Cost by category" })).toBeVisible();

    await card.getByRole("button", { name: `${first.code} · ${first.name}` }).click();
    await expect(page.getByRole("dialog")).toContainText(`${first.code} · ${first.name}`);
  });

  test("a job with no cost says so", async ({ page, seededOrg: _ }) => {
    const all = await costings(page);
    const noCost = all.find((j) => j.costing.byCategory.length === 0);
    test.skip(!noCost, "every demo job has cost");
    await page.goto(`/jobs/${noCost!.id}`);
    await page.getByRole("tab", { name: "Costing" }).click();
    await expect(page.getByText("No costs yet — bills and approved expenses tagged to this job show up here.")).toBeVisible();
  });
});
