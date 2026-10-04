import { test, expect } from "./fixtures";

test.describe("US-RPT-13", () => {
  test("Reports › Trial Balance shows balanced totals, zero-balance accounts on request, and drills into an account", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/reports");
    await page.getByRole("tab", { name: "Trial Balance" }).click();

    await expect(page.getByTestId("trial-balance-status")).toHaveText("Balanced — total debits equal total credits.");
    const table = page.getByTestId("trial-balance-table");
    await expect(table.getByRole("columnheader")).toHaveText(["Code", "Account", "Debit", "Credit"]);
    await expect(table.locator("tfoot")).toContainText("Total");
    const withBalance = await table.locator("tbody tr").count();

    await page.getByText("Hide accounts with no balance").click();
    await expect.poll(async () => table.locator("tbody tr").count()).toBeGreaterThan(withBalance);

    await expect(page.getByRole("link", { name: "Export CSV" })).toHaveAttribute("href", /\/reports\/trial-balance\/export\.csv/);

    await table.getByRole("button", { name: "Accounts Receivable" }).click();
    await expect(page.getByRole("dialog")).toContainText("1100");
  });
});
