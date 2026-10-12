import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-BANK-05", () => {
  test("record money in and money out with tax, see them in the register, then delete one", async ({ page }) => {
    await signUpNewOrg(page, { name: "Money Owner", email: `e2e-bank-05-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const res = await page.request.post(`${API_URL}/tax-rates`, { data: { name: "GST 18%", rate: 18 }, headers: { "Idempotency-Key": randomUUID() } });
    expect(res.ok(), await res.text()).toBe(true);

    await page.goto("/banking");
    await page.getByRole("button", { name: "Money in", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("combobox", { name: "Into account" })).toHaveText("Bank Account");
    await expect(dialog.getByRole("group", { name: "Category shortcuts" }).getByRole("button")).toHaveText(["Owner's capital", "Loan received", "Interest received"]);
    await expect(dialog.getByRole("combobox", { name: "Tax" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Owner's capital" }).click();
    await expect(dialog.getByRole("combobox", { name: "Category" })).toHaveText("3000 · Owner's Capital");
    await dialog.locator('input[inputmode="decimal"]').fill("10000");
    await dialog.getByLabel("Description").fill("Capital top-up");
    await dialog.getByRole("button", { name: "Record money in" }).click();
    // US-BANK-15: it asks first, saying what posts where.
    const askIn = page.getByRole("alertdialog", { name: "Record money in?" });
    await expect(askIn).toContainText("$10,000.00 into Bank Account from Owner's Capital");
    await expect(askIn).toContainText("It's posted to your books.");
    await askIn.getByRole("button", { name: "Record" }).click();
    await expect(page.getByText("Money in recorded").first()).toBeVisible();

    // Control accounts aren't offered.
    await page.getByRole("button", { name: "Money out", exact: true }).click();
    await expect(dialog.getByRole("group", { name: "Category shortcuts" }).getByRole("button")).toHaveText(["Owner's drawings", "Loan repayment", "Bank charges"]);
    await dialog.getByRole("combobox", { name: "Category" }).click();
    await page.getByPlaceholder("Search…").fill("Receivable");
    await expect(page.getByText("No matching account. Use a payment, bill or tax payment for this.")).toBeVisible();
    await page.keyboard.press("Escape");

    await dialog.getByRole("button", { name: "Bank charges" }).click();
    await dialog.locator('input[inputmode="decimal"]').fill("11.80");
    await dialog.getByRole("combobox", { name: "Tax" }).click();
    await page.getByRole("option", { name: "GST 18%" }).click();
    await expect(dialog).toContainText("Includes $1.80 tax, which goes to Input Tax Receivable.");
    await dialog.getByRole("button", { name: "Record money out" }).click();
    const askOut = page.getByRole("alertdialog", { name: "Record money out?" });
    await expect(askOut).toContainText("$11.80 from Bank Account to Other Expenses");
    await expect(askOut).toContainText("including $1.80 tax");
    await askOut.getByRole("button", { name: "Record" }).click();
    await expect(page.getByText("Money out recorded").first()).toBeVisible();

    const table = page.getByTestId("money-accounts-table");
    await expect(table.getByRole("row", { name: /Bank Account/ })).toContainText("$9,988.20");
    await table.getByRole("link", { name: "Bank Account" }).click();
    const register = page.getByTestId("register-table");
    await expect(register.getByRole("row", { name: /Money in — Owner's Capital/ })).toContainText("Capital top-up");
    const charges = register.getByRole("row", { name: /Money out — Other Expenses/ });
    await expect(charges).toContainText("$11.80");

    // US-BANK-14: its drawer shows the category and tax, and deletes it (asking first).
    await charges.getByRole("button", { name: /Actions for/ }).click();
    await page.getByRole("menuitem", { name: "View entry" }).click();
    const drawer = page.getByTestId("register-entry-drawer");
    await expect(drawer).toContainText("6900 · Other Expenses");
    await expect(drawer).toContainText("GST 18% · $1.80 included");
    await drawer.getByRole("button", { name: "Delete entry" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete entry" }).click();
    await expect(page.getByText("Entry deleted").first()).toBeVisible();
    await expect(register.getByRole("row", { name: /Money out deleted — Other Expenses/ })).toBeVisible();

    await page.goto("/banking");
    await expect(table.getByRole("row", { name: /Bank Account/ })).toContainText("$10,000.00");
  });
});
