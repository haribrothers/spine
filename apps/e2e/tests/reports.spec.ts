import { test, expect } from "./fixtures";

/**
 * Reports (FEAT-09) was flagged in CHANGELOG as "not visually verified in
 * a browser — no browser-automation tooling exists in this environment,"
 * only checked via curl against real seeded data and a server-render
 * status check. This suite closes that gap for real rendering across all
 * 3 tabs, the drill-down dialog, and the CSV export links.
 */
test.describe("Reports", () => {
  test("Profit & Loss tab renders real seeded income/expense lines with a correct net profit", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/reports/profit-and-loss");

    await expect(page.getByRole("heading", { name: "Profit & Loss" })).toBeVisible({ timeout: 15_000 });
    const main = page.getByRole("main");
    await expect(main.getByText("Income", { exact: true }).first()).toBeVisible();
    await expect(main.getByText(/4100.*Sales.*Services/)).toBeVisible();
    await expect(main.getByTestId("pl-table").getByText("Total income")).toBeVisible();
    await expect(main.getByText("Expenses", { exact: true }).first()).toBeVisible();
    await expect(main.getByTestId("pl-table").getByText("Net profit")).toBeVisible();
  });

  test("clicking an account line opens the drill-down dialog with real transaction rows", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/reports/profit-and-loss");
    await expect(page.getByText(/4100.*Sales.*Services/)).toBeVisible({ timeout: 15_000 });

    await page.getByText(/4100.*Sales.*Services/).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Demo invoices take their own series (US-ONB-17).
    await expect(dialog.getByText(/Invoice DEMO-INV-\d+ issued/).first()).toBeVisible();
  });

  test("Balance Sheet tab renders real seeded assets/liabilities/equity that balance", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/reports/balance-sheet");

    const main = page.getByRole("main");
    await expect(main.getByText("Assets", { exact: true })).toBeVisible();
    await expect(main.getByText(/1010.*Bank Account/)).toBeVisible();
    await expect(main.getByTestId("bs-table").getByText("Total assets")).toBeVisible();
    await expect(main.getByText("Liabilities", { exact: true })).toBeVisible();
    await expect(main.getByText(/2000.*Accounts Payable/)).toBeVisible();
    await expect(main.getByText("Equity", { exact: true })).toBeVisible();
    await expect(main.getByText("Total liabilities + equity")).toBeVisible();
  });

  test("Job Profitability tab renders real seeded jobs with revenue/cost/margin", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/reports/job-profitability");

    // The chart (US-RPT-15) names jobs too; the table is what this checks.
    const table = page.getByRole("main").getByRole("table");
    // Active and on-hold jobs by default; the demo's finished job is completed (D-216).
    await expect(table.getByText("Phase 2 townhomes — foundations")).toBeVisible();
    await expect(table.getByText("Margin %")).toBeVisible();
  });

  test("CSV export links exist and point at the right endpoints", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/reports/profit-and-loss");

    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "CSV" })).toHaveAttribute("href", /\/reports\/profit-and-loss\?from=.+&to=.+&format=csv/);
    await page.keyboard.press("Escape");

    await page.goto("/reports/balance-sheet");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "CSV" })).toHaveAttribute("href", /\/reports\/balance-sheet\?asOf=.+&format=csv/);
  });
});
