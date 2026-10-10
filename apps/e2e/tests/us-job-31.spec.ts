import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { completeMilestone, fieldUserOn, invoiceMilestone, jobWithMilestones } from "./job-seed";

test.describe("US-JOB-31", () => {
  test("the cards: active with its value, ready to bill with its amount, retention held — and the first three filter", async ({ page, seededOrg: _ }) => {
    const tag = randomUUID().slice(0, 4);
    const { job, milestones } = await jobWithMilestones(page, { name: `Ready to bill ${tag}`, contract: "1000000", retentionPct: 5 });
    await completeMilestone(page, job.id, milestones[0]!.id);
    await invoiceMilestone(page, job.id, milestones[0]!.id);
    await completeMilestone(page, job.id, milestones[1]!.id);
    const { job: idle } = await jobWithMilestones(page, { name: `Nothing to bill ${tag}` });

    await page.goto("/jobs");
    const stats = page.getByTestId("job-stats");
    await expect(stats).toContainText("Active");
    await expect(stats).toContainText("Over or near budget");
    const ready = page.getByRole("button", { name: /^Show jobs ready to bill, \d+$/ });
    await expect(ready).toContainText("$4,000.00");
    await expect(stats).toContainText("Retention held");
    await expect(stats).toContainText(/Across \d+ jobs?/);

    await ready.click();
    await expect(ready).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/card=ready/);
    await expect(ready).toContainText("Showing these · press again to clear");
    await expect(page.getByRole("row").filter({ hasText: `Ready to bill ${tag}` })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: idle.name })).toHaveCount(0);
    await page.reload();
    await expect(ready).toHaveAttribute("aria-pressed", "true");
    await ready.click();
    await expect(ready).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/card=/);

    const active = page.getByRole("button", { name: /^Show active jobs, \d+$/ });
    await active.click();
    await expect(page).toHaveURL(/card=active/);
    await expect(page.getByRole("button", { name: /^Show jobs over or near budget, \d+$/ })).toHaveAttribute("aria-pressed", "false");
  });

  test("a Field user sees no money cards", async ({ page, seededOrg: _, browser }) => {
    const { job } = await jobWithMilestones(page);
    const fieldPage = await fieldUserOn(page, browser, job.id);
    await fieldPage.goto("/jobs");
    await expect(fieldPage.getByRole("row").filter({ hasText: job.name })).toBeVisible();
    await expect(fieldPage.getByTestId("job-stats")).toHaveCount(0);
  });
});
