import { test, expect } from "./fixtures";

test.describe("US-DASH-14", () => {
  test("the KPI row shows each figure with its trend and comparison, and each card opens its report", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    const row = page.getByTestId("kpi-row");
    for (const [key, label] of [
      ["cash", "Cash position"],
      ["profit", "Profit this month"],
      ["receivables", "Receivables"],
      ["overdue", "Overdue"],
    ] as const) {
      const card = row.locator(`[data-kpi="${key}"]`);
      await expect(card.getByText(label, { exact: true })).toBeVisible();
      await expect(card).toContainText(/(▲|▼) [+−]\d+\.\d% vs last month|No data last month|No change vs last month|No data yet/);
    }
    await expect(row.locator('[data-kpi="receivables"]')).toContainText(/Current \$[\d,.]+ · overdue \$[\d,.]+/);
    await expect(row.locator('[data-kpi="overdue"]')).toContainText(/\d+ invoices?/);

    await row.locator('[data-kpi="overdue"]').click();
    await expect(page).toHaveURL(/\/receivables\?overdue=1/);
    await expect(page.getByText("Showing overdue invoices only.")).toBeVisible();

    await page.goto("/dashboard");
    await page.getByTestId("kpi-row").locator('[data-kpi="cash"]').click();
    // US-RPT-23: each report is its own page.
    await expect(page).toHaveURL(/\/reports\/balance-sheet$/);
    await expect(page.getByRole("heading", { name: "Balance Sheet" })).toBeVisible();
  });
});
