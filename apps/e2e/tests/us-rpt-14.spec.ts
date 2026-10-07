import { test, expect } from "./fixtures";

test.describe("US-RPT-14", () => {
  test("Reports › Tax Summary shows collected, paid, net payable and the per-rate breakdown", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/reports/tax-summary");

    const cards = page.getByTestId("tax-summary-cards");
    await expect(cards).toContainText("Tax collected");
    await expect(cards).toContainText("On issued invoices, after credit notes");
    await expect(cards).toContainText("Tax paid");
    await expect(cards).toContainText("On recorded vendor bills and approved expenses");
    await expect(cards).toContainText("Net payable");

    const table = page.getByTestId("tax-summary-table");
    await expect(table.getByRole("columnheader")).toHaveText(["Collected by rate", "Taxable amount", "Tax"]);
    await expect(table).toContainText("Adjustments from credit notes and voided invoices");
    await expect(table.locator("tfoot")).toContainText("Total collected");
    await expect(page.getByText(`Spine produces the numbers for your return; it doesn't file it. Owners, and members with "View financial statements", can see this report.`)).toBeVisible();
  });
});
