import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

async function openPane(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /Owner/ }).last().click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Payment instructions" }).click();
  return dialog;
}

test.describe("US-INV-16", () => {
  test("an owner sets payment instructions, and more than 600 characters is refused", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-inv-16-${randomUUID()}@example.com`, password: "TestPassword123!" });
    let dialog = await openPane(page);
    await expect(dialog).toContainText("Printed under the totals on every invoice and in invoice emails, so customers know how to pay.");
    await expect(dialog).toContainText("Up to 600 characters. Leave empty to hide the block.");
    await expect(dialog).toContainText(
      "Issued invoices keep the instructions they were issued with — changing this only affects invoices issued from now on.",
    );

    const field = dialog.getByLabel("How customers can pay");
    await field.fill("x".repeat(601));
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Keep this under 600 characters.")).toBeVisible();

    const instructions = "Bank transfer to Riverstone Builders LLC\nPlease use the invoice number as the reference.";
    await field.fill(instructions);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Your changes have been saved.")).toBeVisible();

    await page.keyboard.press("Escape");
    await page.reload();
    dialog = await openPane(page);
    await expect(dialog.getByLabel("How customers can pay")).toHaveValue(instructions);
  });
});
