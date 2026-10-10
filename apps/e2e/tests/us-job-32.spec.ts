import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { jobWithMilestones } from "./job-seed";
import { api } from "./quote-seed";

test.describe("US-JOB-32", () => {
  test("search, status and contact stay in the address; Clear filters clears them; Refresh reloads in place", async ({ page, seededOrg: _ }) => {
    const tag = randomUUID().slice(0, 4);
    const { job } = await jobWithMilestones(page, { name: `Clinic ${tag}`, siteAddress: `Jayanagar ${tag}, Bengaluru` });
    const { job: held } = await jobWithMilestones(page, { name: `Data hall ${tag}` });
    await api(page, "PUT", `/jobs/${held.id}`, { status: "on_hold" });

    await page.goto("/jobs");
    await expect(page.getByRole("button", { name: "Refresh list" })).toBeVisible();
    await expect(page.getByTestId("jobs-updated")).toHaveText(/Updated/);

    // Search by site address.
    await page.getByRole("searchbox", { name: "Search jobs" }).fill(`Jayanagar ${tag}`);
    await expect(page).toHaveURL(/q=Jayanagar/);
    await expect(page.getByRole("row").filter({ hasText: job.name })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: held.name })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("searchbox", { name: "Search jobs" })).toHaveValue(`Jayanagar ${tag}`);
    await expect(page.getByRole("row").filter({ hasText: job.name })).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page).not.toHaveURL(/q=/);

    // Status, from the address too.
    await page.goto("/jobs?status=on_hold");
    await expect(page.getByRole("row").filter({ hasText: held.name })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: job.name })).toHaveCount(0);

    // Only contacts with a job are offered.
    await page.goto("/jobs");
    await page.getByRole("combobox", { name: "Filter by contact" }).click();
    const options = await page.getByRole("listbox").getByRole("option").allTextContents();
    expect(options[0]).toBe("All contacts");
    expect(options.length).toBeGreaterThan(1);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Refresh list" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Jobs updated" })).toBeAttached();
  });
});
