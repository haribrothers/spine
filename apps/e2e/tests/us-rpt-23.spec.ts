import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-RPT-23", () => {
  test("every report grouped on one page; search; favourites kept after a reload; old links still land", async ({ page }) => {
    await signUpNewOrg(page, { name: "Reports Owner", email: `e2e-rpt-23-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.goto("/reports");
    await expect(page.getByText("Every report you can open, derived from the ledger.")).toBeVisible();
    const groups = page.getByTestId("report-group");
    await expect(groups.filter({ hasText: "Business overview" })).toContainText("Profit & Loss");
    await expect(groups.filter({ hasText: "Business overview" })).toContainText("Trial Balance");
    await expect(groups.filter({ hasText: "Accountant" })).toContainText("Journals");
    await expect(groups.filter({ hasText: "Jobs" })).toContainText("Job profitability");

    await page.getByRole("textbox", { name: "Search reports" }).fill("ledger");
    await expect(page.getByRole("link", { name: "Trial Balance" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Journals" }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: "Profit & Loss" })).toHaveCount(0);
    await page.getByRole("textbox", { name: "Search reports" }).fill("");

    await expect(page.getByTestId("report-favourites")).toHaveCount(0);
    // Each star saves the whole list: let one save finish before the next, and before the reload.
    const saved = () => page.waitForResponse((res) => res.request().method() === "PUT" && res.url().includes("/favourite"));
    await Promise.all([saved(), page.getByRole("button", { name: "Add Tax Summary to favourites" }).click()]);
    await Promise.all([saved(), page.getByRole("button", { name: "Add Profit & Loss to favourites" }).click()]);
    await expect(page.getByTestId("report-favourites")).toContainText("Tax Summary");
    await page.reload();
    await expect(page.getByTestId("report-favourites").getByRole("link")).toHaveText(["Tax Summary", "Profit & Loss"]);
    await expect(page.getByRole("button", { name: "Remove Tax Summary from favourites" })).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("report-favourites").getByRole("link", { name: "Profit & Loss" }).click();
    await page.waitForURL("**/reports/profit-and-loss");
    await expect(page.getByRole("heading", { name: "Profit & Loss" })).toBeVisible();

    // The dashboard's old links still land on the report.
    await page.goto("/reports?tab=bs");
    await page.waitForURL("**/reports/balance-sheet");
  });
});
