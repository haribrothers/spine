import { test, expect } from "./fixtures";

/** Every report, with the range its header should name (null: no date filter). */
const REPORTS: { path: string; title: string; range: RegExp | null }[] = [
  { path: "/reports/profit-and-loss", title: "Profit & Loss", range: /· Jan 1 – .+\d{4} · Accrual basis/ },
  { path: "/reports/balance-sheet", title: "Balance Sheet", range: /· As of .+\d{4}/ },
  { path: "/reports/trial-balance", title: "Trial Balance", range: /· As of .+\d{4}/ },
  { path: "/reports/cash-flow", title: "Cash Flow", range: /· .+\d{4}/ },
  { path: "/reports/tax-summary", title: "Tax Summary", range: /· Jan 1 – .+\d{4}/ },
  { path: "/reports/job-profitability", title: "Job profitability", range: null },
  { path: "/reports/general-ledger", title: "General ledger", range: /· .+\d{4}/ },
  { path: "/reports/day-book", title: "Day book", range: /· .+\d{4}/ },
  { path: "/reports/sales-by-customer", title: "Sales by customer", range: /· .+\d{4}/ },
  { path: "/reports/sales-by-item", title: "Sales by item", range: /· .+\d{4}/ },
  { path: "/reports/expenses-by-category", title: "Expenses by category", range: /· .+\d{4}/ },
  { path: "/reports/purchases-by-vendor", title: "Purchases by vendor", range: /· .+\d{4}/ },
  { path: "/reports/payments-received", title: "Payments received", range: /· .+\d{4}/ },
  { path: "/reports/payments-made", title: "Payments made", range: /· .+\d{4}/ },
  { path: "/reports/credit-notes-and-refunds", title: "Credit notes and refunds", range: /· .+\d{4}/ },
  { path: "/reports/vendor-credits", title: "Vendor credits", range: /· .+\d{4}/ },
  // Receivables uses the list layout every refined list shares since D-224 (US-PAY-27 to US-PAY-31).
  { path: "/payables", title: "Payables", range: null },
];

test.describe("US-RPT-40", () => {
  test("every report has the same layout: range in the header, labelled filters with Export on the right, one row of KPI cards, no Refresh", async ({ page, seededOrg }) => {
    void seededOrg;
    test.setTimeout(180_000);
    for (const report of REPORTS) {
      await page.goto(report.path);
      await expect(page.getByRole("heading", { name: report.title, level: 1, exact: true })).toBeVisible();
      if (report.range) await expect(page.locator("main h1 + p"), report.path).toContainText(report.range);
      const toolbar = page.getByTestId("report-toolbar");
      await expect(toolbar, report.path).toBeVisible();
      await expect(toolbar.getByRole("button", { name: "Export", exact: true }), report.path).toBeVisible();
      await expect(page.getByRole("button", { name: "Refresh" }), report.path).toHaveCount(0);
      // One row of three or four KPI cards.
      const kpis = page.locator('[data-slot="report-kpis"]');
      await expect(kpis, report.path).toHaveCount(1);
      expect([3, 4], report.path).toContain(await kpis.locator(":scope > *").count());
    }
  });

  test("filters apply as they change; statements share tabs; totals rows; the primary action comes after Export", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/reports/profit-and-loss");
    // The chart of each month, and the four statements as tabs.
    await expect(page.getByTestId("pl-chart")).toContainText("Income and expenses by month");
    for (const tab of ["Profit & Loss", "Balance Sheet", "Trial Balance", "Cash Flow"]) await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    // Choosing a comparison reloads the report — no Refresh.
    await page.getByRole("combobox", { name: "Compare with" }).click();
    await page.getByRole("option", { name: "Previous period" }).click();
    await expect(page.getByTestId("pl-compare-table").getByRole("columnheader", { name: "Change %" })).toBeVisible();
    await expect(page.locator("main h1 + p")).toContainText("compared with");
    await expect(page.getByTestId("pl-compare-table").locator("tfoot")).toContainText("Net profit");

    await page.getByRole("tab", { name: "Balance Sheet" }).click();
    await expect(page).toHaveURL(/\/reports\/balance-sheet$/);
    await expect(page.getByTestId("bs-table").locator("tfoot")).toContainText("Total liabilities + equity");

    await page.goto("/reports/sales-by-customer");
    await expect(page.getByTestId("sales-table").locator("tfoot")).toContainText("Total");

    await page.goto("/reports/tax-summary");
    const actions = page.getByTestId("report-toolbar").getByRole("button");
    await expect(actions.last()).toHaveText("Record tax payment");
    await expect(actions.nth(-2)).toHaveText(/Export/);

    // Receivables: four cards and the age bar naming every bucket; the age filter sits in the list's filter bar (D-224).
    await page.goto("/receivables");
    const chart = page.getByTestId("aging-chart");
    for (const bucket of ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"]) await expect(chart).toContainText(bucket);
    await expect(page.getByTestId("aging-cards")).toContainText("Total outstanding");
    await page.getByRole("combobox", { name: "Show by age" }).click();
    await page.getByRole("option", { name: "Overdue" }).click();
    await expect(page).toHaveURL(/\/receivables\?age=overdue$/);
  });
});
