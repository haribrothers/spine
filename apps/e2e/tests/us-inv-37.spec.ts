import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { taxedInvoice } from "./credit-note-seed";

test.describe("US-INV-37", () => {
  test("New credit note asks which invoice, then credits an amount and opens the credit note", async ({ page }) => {
    await signUpNewOrg(page, { name: "Credit Owner", email: `e2e-inv-37-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Sahyadri Retail");
    const inv = await taxedInvoice(page, c.id);

    await page.goto("/credit-notes");
    await page.getByRole("button", { name: "New credit note" }).first().click();
    const picker = page.getByRole("dialog", { name: "New credit note" });
    await picker.getByLabel("Search invoices to credit").fill("sahyadri");
    await picker.getByRole("option", { name: new RegExp(inv.number) }).click();
    await picker.getByRole("button", { name: "Continue" }).click();

    const dialog = page.getByRole("dialog", { name: "Issue a credit note" });
    await dialog.getByRole("tab", { name: "Credit an amount" }).click();
    await dialog.getByLabel("Amount to credit").fill("100");
    await expect(dialog.getByTestId("credit-totals")).toContainText("$100.00");
    await dialog.getByRole("button", { name: "Issue credit note" }).click();
    await expect(page).toHaveURL(/\/credit-notes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^CRN-\d{4}$/);
    await expect(page.getByTestId("credit-note-meta")).toContainText(`Against ${inv.number}`);
  });
});
