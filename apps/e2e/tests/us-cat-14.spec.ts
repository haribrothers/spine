import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { seedCatalog } from "./catalog-seed";

test.describe("US-CAT-14", () => {
  test("the tabs show counts, Bundles' empty state opens Items, and a bundle is made from selected items", async ({ page }) => {
    await signUpNewOrg(page, { name: "Catalogue Owner", email: `e2e-cat-14-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await seedCatalog(page, [
      { name: "Cement", price: "41000", unit: "bag" },
      { name: "Tiling", price: "95000", unit: "sq m", taxed: false },
      { name: "Imported fixture", price: "5000", currency: "EUR" },
    ]);
    await page.goto("/catalog?tab=bundles");
    await expect(page.getByRole("tab", { name: "Items, 3" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Bundles, 0" })).toBeVisible();
    const empty = page.getByTestId("bundles-empty");
    await expect(empty).toContainText("No bundles yet");
    await expect(empty).toContainText("Group what you quote together. Select items and choose Make a bundle, or save a quote's lines from its More menu.");
    await empty.getByRole("button", { name: "Choose items" }).click();
    await expect(page.getByRole("tab", { name: "Items, 3" })).toHaveAttribute("aria-selected", "true");

    // Two currencies can't share a bundle.
    await page.getByRole("checkbox", { name: "Select Cement" }).check();
    await page.getByRole("checkbox", { name: "Select Imported fixture" }).check();
    await page.getByRole("region", { name: "Selected items" }).getByRole("button", { name: "Make a bundle" }).click();
    let dialog = page.getByRole("dialog", { name: "Make a bundle" });
    await expect(dialog).toContainText("Choose items in one currency.");
    await expect(dialog.getByRole("button", { name: "Save bundle" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("checkbox", { name: "Select Imported fixture" }).uncheck();

    await page.getByRole("checkbox", { name: "Select Tiling" }).check();
    await page.getByRole("region", { name: "Selected items" }).getByRole("button", { name: "Make a bundle" }).click();
    dialog = page.getByRole("dialog", { name: "Make a bundle" });
    await expect(dialog.getByLabel("Quantity of Cement")).toHaveValue("1");
    await dialog.getByLabel(/^Name/).fill("Bathroom refit");
    await dialog.getByLabel("Quantity of Cement").fill("2");
    await dialog.getByLabel("Quantity of Tiling").fill("1.5");
    await expect(dialog.getByTestId("bundle-total")).toHaveText("$2,245.00");
    await dialog.getByRole("button", { name: "Save bundle" }).click();
    await expect(page.getByText("Bundle saved", { exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Bundles, 1" })).toBeVisible();

    await page.getByRole("tab", { name: "Bundles, 1" }).click();
    // 2 × $410.00 + 8% tax = $885.60; 1.5 × $950.00 = $1,425.00.
    await expect(page.getByRole("table").getByRole("row", { name: /Bathroom refit/ })).toContainText("$2,310.60");
  });
});
