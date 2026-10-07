import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg } from "./helpers";

test.describe("US-RPT-39", () => {
  test("an Owner sees each account pre-mapped to a Tally group, changes one and saves it", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-rpt-39-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await page.goto("/reports/tally/mapping");
    await expect(page.getByRole("heading", { name: "Account mapping" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Export to Tally" })).toBeVisible();
    await expect(page.getByText("Choose the Tally group each account lands in.")).toBeVisible();

    const table = page.getByTestId("tally-mapping");
    await expect(table.getByRole("columnheader")).toContainText(["Code", "Account", "Spine type", "Tally group"]);
    await expect(page.getByTestId("tally-group-1000")).toHaveText("Cash-in-Hand");
    await expect(page.getByTestId("tally-group-1010")).toHaveText("Bank Accounts");
    await expect(page.getByTestId("tally-group-1200")).toHaveText("Duties & Taxes");
    await expect(page.getByText("Customers go under Sundry Debtors and vendors under Sundry Creditors.", { exact: false })).toBeVisible();
    await expectNoAxeViolations(page);

    const save = page.getByRole("button", { name: "Save mapping" });
    await expect(save).toBeDisabled();
    await page.getByRole("combobox", { name: "Account type" }).click();
    await page.getByRole("option", { name: "Expense", exact: true }).click();
    await table.getByPlaceholder("Search accounts").fill("Rent");
    const rent = page.getByRole("combobox", { name: "Tally group for 6000 Rent" });
    await expect(rent).toHaveText("Indirect Expenses");
    await rent.click();
    await page.getByRole("option", { name: "Direct Expenses", exact: true }).click();
    await save.click();
    await expect(page.getByText("Mapping saved").first()).toBeVisible();

    await page.reload();
    await page.getByTestId("tally-mapping").getByPlaceholder("Search accounts").fill("Rent");
    await expect(page.getByTestId("tally-group-6000")).toHaveText("Direct Expenses");
  });
});
