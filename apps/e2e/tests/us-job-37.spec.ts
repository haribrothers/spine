import { test, expect } from "./fixtures";
import { completeMilestone, fieldUserOn, invoiceMilestone, jobWithMilestones, uploadPhoto } from "./job-seed";
import { api } from "./quote-seed";

test.describe("US-JOB-37", () => {
  test("the Activity panel tells the job's story newest first, with who and when, and shows the rest on request", async ({ page, seededOrg: _ }) => {
    const { job, milestones } = await jobWithMilestones(page);
    await completeMilestone(page, job.id, milestones[0]!.id, [await uploadPhoto(page), await uploadPhoto(page), await uploadPhoto(page)]);
    const invoice = await invoiceMilestone(page, job.id, milestones[0]!.id);
    await api(page, "POST", `/jobs/${job.id}/notes`, { body: "Gate code 4711." });
    await api(page, "PUT", `/jobs/${job.id}`, { status: "on_hold" });
    await api(page, "PUT", `/jobs/${job.id}`, { status: "active" });
    await api(page, "PUT", `/jobs/${job.id}`, { notes: "Key with security." });
    await api(page, "PUT", `/jobs/${job.id}`, { status: "on_hold" });

    await page.goto(`/jobs/${job.id}`);
    const activity = page.getByTestId("job-activity");
    const items = activity.locator("ol > li");
    await expect(items.first()).toContainText("Status changed to On hold");
    await expect(activity).toContainText("Note added");
    await expect(activity.getByRole("link", { name: "Milestone invoiced" })).toHaveAttribute("href", `/invoices/${invoice.id}`);
    await expect(activity).toContainText(`Site preparation · ${invoice.number}`);
    await expect(activity).toContainText("3 photos added with Site preparation");
    await expect(activity).toContainText("Milestone completed · Site preparation");
    await expect(activity.getByRole("button", { name: /^Show \d+ earlier$/ })).toBeVisible();
    await activity.getByRole("button", { name: /^Show \d+ earlier$/ }).click();
    await expect(items.last()).toContainText("Created");
    await expect(activity).toContainText("Milestones set · 3 milestones");

    await activity.getByRole("button", { name: "View history" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("a Field user gets no Activity", async ({ page, seededOrg: _, browser }) => {
    const { job } = await jobWithMilestones(page);
    const fieldPage = await fieldUserOn(page, browser, job.id);
    await fieldPage.goto(`/jobs/${job.id}`);
    await expect(fieldPage.getByTestId("milestones")).toBeVisible();
    await expect(fieldPage.getByTestId("job-activity")).toHaveCount(0);
  });
});
