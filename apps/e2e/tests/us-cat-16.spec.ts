import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { seedCatalog } from "./catalog-seed";

test.describe("US-CAT-16", () => {
  test("bulk Set tax and Set category ask first; Go back keeps the selection; Archive doesn't ask", async ({ page }) => {
    await signUpNewOrg(page, { name: "Catalogue Owner", email: `e2e-cat-16-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await seedCatalog(page, [
      { name: "Cement", price: "4100", category: "Materials" },
      { name: "Painting", price: "2200", category: "Finishes", taxed: false },
      { name: "Tiling", price: "9500", category: "Finishes", taxed: false },
    ]);
    await page.goto("/catalog");
    const table = page.getByRole("table");
    await page.getByRole("checkbox", { name: "Select Painting" }).check();
    await page.getByRole("checkbox", { name: "Select Tiling" }).check();
    const bar = page.getByRole("region", { name: "Selected items" });

    // Set tax asks, says the new tax and that issued documents keep theirs; Go back changes nothing.
    await bar.getByRole("button", { name: "Set tax" }).click();
    await page.getByRole("menuitem", { name: /Sales tax 8%/ }).click();
    const ask = page.getByRole("alertdialog", { name: "Change the tax on 2 items?" });
    await expect(ask).toContainText("They'll use Sales tax 8% (8%) on new quotes and invoices. Quotes and invoices already issued keep their tax.");
    await ask.getByRole("button", { name: "Go back" }).click();
    await expect(ask).toHaveCount(0);
    await expect(bar).toContainText("2 selected");
    await expect(table.getByTestId("catalog-no-tax")).toHaveCount(2);

    await bar.getByRole("button", { name: "Set tax" }).click();
    await page.getByRole("menuitem", { name: /Sales tax 8%/ }).click();
    await page.getByRole("alertdialog", { name: "Change the tax on 2 items?" }).getByRole("button", { name: "Change tax" }).click();
    await expect(page.getByText("Updated 2 items", { exact: true })).toBeVisible();
    await expect(table.getByTestId("catalog-no-tax")).toHaveCount(0);

    // Set income account asks too.
    await page.getByRole("checkbox", { name: "Select Painting" }).check();
    await page.getByRole("checkbox", { name: "Select Tiling" }).check();
    await bar.getByRole("button", { name: "Set income account" }).click();
    await page.getByRole("menuitem", { name: /^None — posts to 4100/ }).click();
    const account = page.getByRole("alertdialog", { name: "Change the income account on 2 items?" });
    await expect(account).toContainText("New quotes and invoices post their sales to 4100 Sales — Services. Quotes and invoices already issued keep theirs.");
    await account.getByRole("button", { name: "Go back" }).click();
    await expect(bar).toContainText("2 selected");
    await bar.getByRole("button", { name: "Set income account" }).click();
    await page.getByRole("menuitem", { name: /^None — posts to 4100/ }).click();
    await page.getByRole("alertdialog", { name: "Change the income account on 2 items?" }).getByRole("button", { name: "Change account" }).click();
    await expect(bar).toHaveCount(0); // done: the selection clears
    await expect(page.getByText("Updated 2 items", { exact: true }).first()).toBeVisible();

    // Set category asks "Move 2 items to “Labour”?".
    await page.getByRole("checkbox", { name: "Select Painting" }).check();
    await page.getByRole("checkbox", { name: "Select Tiling" }).check();
    await bar.getByRole("button", { name: "Set category" }).click();
    const dialog = page.getByRole("dialog", { name: "Set category" });
    await dialog.getByRole("combobox", { name: "Category" }).click();
    await page.getByPlaceholder("Search…").fill("Labour");
    await page.getByRole("option", { name: "Create “Labour”" }).click();
    await dialog.getByRole("button", { name: "Set category" }).click();
    const move = page.getByRole("alertdialog", { name: "Move 2 items to “Labour”?" });
    await move.getByRole("button", { name: "Move items" }).click();
    await expect(page.getByText("Updated 2 items", { exact: true }).first()).toBeVisible();
    await expect(table.getByRole("row", { name: /Painting/ })).toContainText("Labour");

    // Archive doesn't ask — Restore undoes it.
    await page.getByRole("checkbox", { name: "Select Cement" }).check();
    await bar.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByText("Archived 1 item", { exact: true })).toBeVisible();
  });
});
