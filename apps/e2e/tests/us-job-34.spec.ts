import { test, expect } from "./fixtures";
import { completeMilestone, fieldUserOn, invoiceMilestone, jobWithMilestones } from "./job-seed";
import { api } from "./quote-seed";

test.describe("US-JOB-34", () => {
  test("the number is the title; contact, site map and dates; the status changes in place, and Cancelled asks first", async ({ page, seededOrg: _ }) => {
    const { job, contactId } = await jobWithMilestones(page, { name: "Warehouse extension", siteAddress: "Baner Road, Pune 411045", startInDays: -10, endInDays: 40 });
    await page.goto(`/jobs/${job.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(job.number);
    await expect(page.getByTestId("job-name")).toHaveText("Warehouse extension");
    await expect(page.getByRole("button", { name: "Back to jobs" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: /breadcrumb/i }).getByRole("link", { name: "Jobs" })).toBeVisible();
    const meta = page.getByTestId("job-meta");
    await expect(meta.getByRole("link").first()).toHaveAttribute("href", `/contacts/${contactId}`);
    await expect(meta.getByRole("link", { name: /Baner Road, Pune 411045/ })).toHaveAttribute("href", /google\.com\/maps\/search\/\?api=1&query=Baner/);
    await expect(meta).toContainText(/Started \w+ \d+ · Due \w+ \d+/);

    await page.getByTestId("job-status").click();
    await page.getByRole("menuitem", { name: "On hold" }).click();
    await expect(page.getByText(`${job.number} is now on hold.`, { exact: true })).toBeVisible();
    await expect(page.getByTestId("job-status")).toContainText("On hold");

    await page.getByTestId("job-status").click();
    await page.getByRole("menuitem", { name: "Cancelled" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Cancel this job?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Keep the job" }).click();
    await expect(page.getByTestId("job-status")).toContainText("On hold");
  });

  test("one primary next step: invoice a completed milestone, else complete the next, else release retention", async ({ page, seededOrg: _ }) => {
    const { job, milestones } = await jobWithMilestones(page, { retentionPct: 5 });
    await page.goto(`/jobs/${job.id}`);
    const next = page.getByTestId("job-next-step");
    await expect(next).toHaveText("Complete Site preparation");

    await completeMilestone(page, job.id, milestones[0]!.id);
    await page.reload();
    await expect(next).toHaveText("Invoice Site preparation");

    await invoiceMilestone(page, job.id, milestones[0]!.id);
    await api(page, "PUT", `/jobs/${job.id}`, { status: "completed" });
    await page.reload();
    await expect(next).toHaveText("Release retention");
    await next.click();
    await expect(page.getByRole("alertdialog", { name: "Release retention?" })).toContainText("$150.00");
  });

  test("the figures: contract, billed, cost, margin and % complete — and Field sees only % complete", async ({ page, seededOrg: _, browser }) => {
    const { job, milestones } = await jobWithMilestones(page, { contract: "1000000" });
    await completeMilestone(page, job.id, milestones[0]!.id);
    await invoiceMilestone(page, job.id, milestones[0]!.id);
    await page.goto(`/jobs/${job.id}`);
    await expect(page.getByTestId("fig-contract")).toContainText("$10,000.00");
    await expect(page.getByTestId("fig-billed")).toContainText("$3,000.00");
    await expect(page.getByTestId("fig-billed")).toContainText("30% of contract");
    await expect(page.getByTestId("fig-cost")).toContainText("No budget set");
    await expect(page.getByTestId("fig-margin")).toBeVisible();
    await expect(page.getByTestId("fig-complete")).toContainText("33%");

    const fieldPage = await fieldUserOn(page, browser, job.id);
    await fieldPage.goto(`/jobs/${job.id}`);
    await expect(fieldPage.getByTestId("fig-complete")).toContainText("33%");
    for (const id of ["fig-contract", "fig-billed", "fig-cost", "fig-margin"]) await expect(fieldPage.getByTestId(id)).toHaveCount(0);
  });
});
