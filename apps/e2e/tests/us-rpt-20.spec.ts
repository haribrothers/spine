import { randomUUID } from "node:crypto";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

async function pickAccount(page: Page, dialog: Locator, line: number, search: string, option: string) {
  await dialog.getByRole("combobox", { name: `Account, line ${line}` }).click();
  await page.keyboard.type(search);
  await page.getByRole("option", { name: option }).click();
}

test.describe("US-RPT-20", () => {
  test("post a balanced journal; control accounts aren't offered and an unbalanced one can't be posted", async ({ page }) => {
    await signUpNewOrg(page, { name: "Journal Owner", email: `e2e-rpt-20-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.getByRole("link", { name: "Journals" }).click();
    await expect(page.getByRole("heading", { name: "Journals", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "New journal" }).click();
    const dialog = page.getByRole("dialog", { name: "New journal" });
    await expect(dialog).toContainText("For adjustments no document covers. Journals are never edited — a mistake is reversed.");
    await expect(dialog.getByRole("textbox", { name: "Reason" })).toHaveAttribute("placeholder", "e.g. Depreciation for March");
    await expect(dialog).toContainText("Accounts Receivable, Retention Receivable, Input Tax, Accounts Payable, Output Tax, Customer Advances and Opening Balance Adjustments aren't offered");

    // Control accounts aren't offered.
    await dialog.getByRole("combobox", { name: "Account, line 1" }).click();
    await page.keyboard.type("Accounts Receivable");
    await expect(page.getByText("No matching account.")).toBeVisible();
    await page.keyboard.press("Escape");

    await dialog.getByRole("textbox", { name: "Reason" }).fill("Depreciation and audit accrual for September");
    await pickAccount(page, dialog, 1, "6900", "6900 · Other Expenses");
    await dialog.getByRole("textbox", { name: "Debit, line 1" }).fill("400");
    await pickAccount(page, dialog, 2, "1510", "1510 · Accumulated Depreciation");
    await dialog.getByRole("textbox", { name: "Credit, line 2" }).fill("350");
    await expect(dialog.getByTestId("journal-out-by")).toHaveText("Debits and credits must be equal — out by $50.00.");
    await expect(dialog.getByRole("button", { name: "Post journal" })).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Credit, line 2" }).fill("400");
    await expect(dialog.getByTestId("journal-out-by")).toHaveCount(0);
    await expect(dialog.getByTestId("journal-debits")).toHaveText("$400.00");
    await dialog.getByRole("button", { name: "Post journal" }).click();

    await expect(page.getByRole("heading", { name: "JNL-0001" })).toBeVisible();
    await expect(page.getByText("Posted", { exact: true })).toBeVisible();
    await expect(page.getByTestId("journal-detail-lines")).toContainText("6900 · Other Expenses");
    await expect(page.getByTestId("journal-detail-lines")).toContainText("1510 · Accumulated Depreciation");
    await page.getByRole("link", { name: "Back to journals" }).click();
    await expect(page.getByTestId("journals-table")).toContainText("Depreciation and audit accrual for September");
  });
});
