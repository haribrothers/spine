import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-BANK-01", () => {
  test("an Owner sees the starting accounts, adds a bank account and a card, and moves the default", async ({ page }) => {
    await signUpNewOrg(page, { name: "Banking Owner", email: `e2e-bank-01-${randomUUID()}@example.com`, password: "e2e-test-password-1" });

    await page.getByRole("link", { name: "Banking" }).click();
    await page.waitForURL("**/banking");
    const table = page.getByTestId("money-accounts-table");
    await expect(table.getByRole("row", { name: /Bank Account/ })).toContainText("Default");
    await expect(table.getByRole("row", { name: /Cash in Hand/ })).toContainText("$0.00");

    await page.getByRole("button", { name: "Add account" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("radio", { name: "Bank account" })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: "Cash" })).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Credit card" })).toBeVisible();
    await expect(dialog.getByPlaceholder("e.g. HDFC Current")).toBeVisible();
    await expect(dialog).toContainText("Ledger account 1011 · Asset.");
    await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("HDFC Current");
    await dialog.getByLabel("Bank name").fill("HDFC Bank");
    await dialog.getByLabel("Last 4 digits").fill("0193");
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(page.getByText("Account added").first()).toBeVisible();
    await expect(table.getByRole("row", { name: /HDFC Current/ })).toContainText("HDFC Bank · ••0193");
    await expect(table.getByRole("row", { name: /HDFC Current/ })).toContainText("$0.00");

    // Cash has no bank details; a card's balance is what's owed.
    await page.getByRole("button", { name: "Add account" }).click();
    await dialog.getByRole("radio", { name: "Cash" }).click();
    await expect(dialog.getByLabel("Bank name")).toHaveCount(0);
    await dialog.getByRole("radio", { name: "Credit card" }).click();
    await expect(dialog).toContainText("Ledger account 2300 · Liability");
    await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("Business Visa");
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(table.getByRole("row", { name: /Business Visa/ })).toContainText("$0.00 owed");

    // A name already in use.
    await page.getByRole("button", { name: "Add account" }).click();
    await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("hdfc current");
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(dialog).toContainText("You already have an account called hdfc current. Choose another name.");
    await dialog.getByRole("textbox", { name: "Name", exact: true }).fill("First Coastal — Operating");
    await dialog.getByRole("checkbox", { name: /Use as default for new payments/ }).check();
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(table.getByRole("row", { name: /First Coastal — Operating/ })).toContainText("Default");
    await expect(table.getByRole("row", { name: /Bank Account/ })).not.toContainText("Default");
  });
});
