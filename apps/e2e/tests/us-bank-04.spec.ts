import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-BANK-04", () => {
  test("move money between accounts, see it in both registers, then delete it", async ({ page }) => {
    await signUpNewOrg(page, { name: "Transfer Owner", email: `e2e-bank-04-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const res = await page.request.post(`${API_URL}/money-accounts`, { data: { kind: "bank", name: "Tax reserve" }, headers: { "Idempotency-Key": randomUUID() } });
    expect(res.ok()).toBe(true);

    await page.goto("/banking");
    await page.getByRole("button", { name: "Transfer", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Transfer between accounts" })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "From" })).toHaveText("Bank Account");

    // The same account twice is refused.
    await dialog.getByRole("combobox", { name: "To" }).click();
    await page.getByRole("option", { name: "Bank Account" }).click();
    await dialog.locator('input[inputmode="decimal"]').fill("3000");
    // US-BANK-15: the same account twice says why, and Move money stays off.
    await expect(dialog).toContainText("Choose two different accounts.");
    await expect(dialog.getByRole("button", { name: "Move money" })).toBeDisabled();

    await dialog.getByRole("combobox", { name: "To" }).click();
    await page.getByRole("option", { name: "Tax reserve" }).click();
    await dialog.getByLabel("Reference").fill("TRF-0004");
    await expect(dialog).toContainText("Posts Dr Tax reserve / Cr Bank Account. Both registers show it.");
    await dialog.getByRole("button", { name: "Move money" }).click();
    // US-BANK-15: it asks first.
    const ask = page.getByRole("alertdialog", { name: "Move $3,000.00 from Bank Account to Tax reserve?" });
    await expect(ask).toContainText("both registers show the transfer");
    await ask.getByRole("button", { name: "Move money" }).click();
    await expect(page.getByText("Moved $3,000.00 from Bank Account to Tax reserve").first()).toBeVisible();

    const table = page.getByTestId("money-accounts-table");
    await expect(table.getByRole("row", { name: /Tax reserve/ })).toContainText("$3,000.00");
    await expect(table.getByRole("row", { name: /Bank Account/ })).toContainText("−$3,000.00");

    await table.getByRole("link", { name: "Tax reserve" }).click();
    const register = page.getByTestId("register-table");
    await expect(register.getByRole("row", { name: /Transfer from Bank Account/ })).toContainText("TRF-0004");

    await page.goto("/banking");
    await table.getByRole("link", { name: "Bank Account" }).click();
    // US-BANK-14: a transfer opens its drawer, which deletes it (asking first).
    await register.getByRole("button", { name: "Transfer to Tax reserve", exact: true }).click();
    const drawer = page.getByTestId("register-entry-drawer");
    await expect(drawer).toContainText("Tax reserve");
    await expect(drawer).toContainText("TRF-0004");
    await drawer.getByRole("button", { name: "Delete transfer" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete transfer" }).click();
    await expect(page.getByText("Transfer deleted").first()).toBeVisible();
    await expect(register.getByRole("row", { name: /Transfer to Tax reserve/ })).toContainText("Deleted");
    await expect(register.getByRole("row", { name: /^.*Transfer deleted/ })).toContainText("$0.00");

    await page.goto("/banking");
    await expect(table.getByRole("row", { name: /Tax reserve/ })).toContainText("$0.00");
  });
});
