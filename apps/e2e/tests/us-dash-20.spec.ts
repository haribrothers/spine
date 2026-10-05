import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

/** The edit-mode Hide/Show toggle for a widget, found by the overlay's label. */
function editModeHideToggle(page: Page, label: string) {
  return page.locator("span", { hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::button[1]");
}

test.describe("US-DASH-20", () => {
  test("retention held and jobs in progress: shown for Construction, otherwise shown from Edit layout", async ({ page, seededOrg: _ }) => {
    const setting = (await (await page.request.get(`${API_URL}/org/settings/industry_template`)).json()) as { value: { template?: string } | null };
    await page.goto("/dashboard");
    await expect(page.getByTestId("kpi-row")).toBeVisible({ timeout: 15_000 });

    if (setting.value?.template !== "construction") {
      // Other templates start them hidden.
      await expect(page.getByTestId("retention-held")).toHaveCount(0);
      await expect(page.getByTestId("jobs-in-progress")).toHaveCount(0);
      await page.getByRole("button", { name: "Edit layout" }).click();
      await editModeHideToggle(page, "Retention held").click();
      await editModeHideToggle(page, "Jobs in progress").click();
      await page.getByRole("button", { name: "Done" }).click();
    }

    const retention = page.getByTestId("retention-held");
    await expect(retention).toBeVisible();
    await expect(retention).toContainText(/Retention held/);
    // Either the total with its jobs, or the single quiet line.
    await expect(retention).toContainText(/on \d+ jobs? · in Retention Receivable until released|No retention held\./);
    const release = retention.getByRole("link", { name: /^Release retention on / });
    if (await release.count()) await expect(release.first()).toHaveAttribute("href", /\/jobs\/[0-9a-f-]+\?release=1$/);

    const jobs = page.getByTestId("jobs-in-progress");
    await expect(jobs).toContainText("Jobs in progress");
    await expect(jobs.locator("tbody tr").first()).toContainText(/\d+% billed/);
    await expect(jobs.locator("tbody tr").first()).toContainText(/No budget|\d+%|Over|Nearing/);
    await jobs.getByRole("link", { name: "Job profitability" }).click();
    await expect(page).toHaveURL(/\/reports\?tab=jobs/);
  });
});
