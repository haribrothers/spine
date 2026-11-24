import { test, expect } from "./fixtures";
import { completeMilestone, invoiceMilestone, jobWithMilestones, uploadPhoto } from "./job-seed";
import { api } from "./quote-seed";

test.describe("US-JOB-35", () => {
  test("tabs show their counts; milestones read as progress with what's billed, the due state and each one's action", async ({ page, seededOrg: _ }) => {
    const { job, milestones } = await jobWithMilestones(page, {
      contract: "1000000",
      milestones: [
        { name: "Site preparation", amount: 30, dueInDays: -20 },
        { name: "Steel structure", amount: 40, dueInDays: -3 },
        { name: "Roofing & handover", amount: 30, dueInDays: 20 },
      ],
    });
    await completeMilestone(page, job.id, milestones[0]!.id, [await uploadPhoto(page)]);
    await invoiceMilestone(page, job.id, milestones[0]!.id);
    await api(page, "POST", `/jobs/${job.id}/notes`, { body: "Gate code 4711." });
    await api(page, "POST", `/jobs/${job.id}/notes`, { body: "Client away 20–27 Oct." });

    await page.goto(`/jobs/${job.id}`);
    await expect(page.getByRole("tab", { name: "Milestones, 3" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Variation orders, 0" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Photos, 1" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Notes, 2" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Crew, 0" })).toBeVisible();

    await expect(page.getByTestId("milestones-billed")).toHaveText("Billed $3,000.00 of $10,000.00");
    const rows = page.getByTestId("milestone-row");
    await expect(rows.nth(0)).toContainText("Invoiced");
    await expect(rows.nth(0)).toContainText("30% of contract");
    await expect(rows.nth(0).getByRole("link", { name: "View invoice" })).toBeVisible();
    await expect(rows.nth(1)).toContainText("$4,000.00");
    const overdue = rows.nth(1).getByText("Overdue 3 days");
    await expect(overdue).toHaveClass(/text-overdue/);
    await expect(rows.nth(1).getByRole("button", { name: "Mark complete" })).toBeVisible();
    await expect(rows.nth(2)).toContainText(/Due \w+ \d+ · in 20 days/);

    // Adding a note updates the count.
    await page.getByRole("tab", { name: /^Notes/ }).click();
    await page.getByPlaceholder("Add a note about this job…").fill("Scaffold arrives Monday.");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Notes, 3" })).toBeVisible();
  });
});
