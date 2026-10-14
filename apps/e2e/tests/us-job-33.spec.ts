import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { completeMilestone, fieldUserOn, invoiceMilestone, jobWithMilestones } from "./job-seed";

test.describe("US-JOB-33", () => {
  test("each row: number and site under the name, the next milestone's due state, complete and billed %, flagged over the contract", async ({ page, seededOrg: _ }) => {
    const tag = randomUUID().slice(0, 4);
    const { job: soon } = await jobWithMilestones(page, { name: `Office block ${tag}`, siteAddress: "Whitefield, Bengaluru", milestones: [{ name: "Foundations", amount: 100, dueInDays: 3 }] });
    const { job: late } = await jobWithMilestones(page, { name: `Data hall ${tag}`, milestones: [{ name: "Raised floor", amount: 100, dueInDays: -2 }] });
    // Billed past the contract: a fixed milestone of $1,200.00 on a $1,000.00 contract.
    const { job: over, milestones } = await jobWithMilestones(page, { name: `Clinic renovation ${tag}`, contract: "100000", milestones: [{ name: "Everything", amountType: "fixed", amount: 120000 }] });
    await completeMilestone(page, over.id, milestones[0]!.id);
    await invoiceMilestone(page, over.id, milestones[0]!.id);

    await page.goto("/jobs");
    const soonRow = page.getByRole("row").filter({ hasText: soon.name });
    await expect(soonRow).toContainText(`${soon.number} · Whitefield, Bengaluru`);
    await expect(soonRow.getByTestId("job-next")).toHaveText(/Foundations\s*Due in 3 days/);
    await expect(soonRow.getByTestId("job-progress")).toContainText("Complete");
    await expect(soonRow.getByTestId("job-progress")).toContainText("Billed");
    await expect(page.getByRole("row").filter({ hasText: late.name }).getByTestId("job-next")).toContainText("Overdue 2 days");

    const overRow = page.getByRole("row").filter({ hasText: over.name });
    await expect(overRow.getByTestId("job-next")).toContainText("All billed");
    const flagged = overRow.getByLabel("120%, billed over the contract");
    await expect(flagged).toBeVisible();
    await flagged.focus();
    await expect(page.getByRole("tooltip")).toHaveText("Billed over the contract");
    await expect(overRow).toContainText("$1,000.00");
  });

  test("a Field user's rows have no money or billed figures", async ({ page, seededOrg: _, browser }) => {
    const { job } = await jobWithMilestones(page, { name: `Field row job ${randomUUID().slice(0, 4)}` });
    const fieldPage = await fieldUserOn(page, browser, job.id);
    await fieldPage.goto("/jobs");
    const row = fieldPage.getByRole("row").filter({ hasText: job.name });
    await expect(row.getByTestId("job-progress")).toContainText("Complete");
    await expect(row.getByTestId("job-progress")).not.toContainText("Billed");
    await expect(row).not.toContainText("$");
    await expect(fieldPage.getByRole("columnheader", { name: /Contract/ })).toHaveCount(0);
  });
});
