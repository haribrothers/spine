import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { seedCatalog } from "./catalog-seed";

test.describe("US-CAT-12", () => {
  test("select items to set their tax or archive them, duplicate one, and export the list", async ({ page }) => {
    await signUpNewOrg(page, { name: "Catalogue Owner", email: `e2e-cat-12-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
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
    await expect(bar).toContainText("2 selected");
    await bar.getByRole("button", { name: "Set tax" }).click();
    await page.getByRole("menuitem", { name: /Sales tax 8%/ }).click();
    await page.getByRole("alertdialog", { name: "Change the tax on 2 items?" }).getByRole("button", { name: "Change tax" }).click(); // US-CAT-16
    await expect(page.getByText("Updated 2 items", { exact: true })).toBeVisible();
    await expect(table.getByRole("row", { name: /Painting/ })).toContainText("Sales tax 8%");
    await expect(table.getByTestId("catalog-no-tax")).toHaveCount(0);

    // A new filter clears the selection.
    await page.getByRole("checkbox", { name: "Select Cement" }).check();
    await page.getByLabel("Search items").fill("e");
    await expect(bar).toHaveCount(0);
    await page.getByLabel("Search items").fill("");

    await page.getByRole("checkbox", { name: "Select Cement" }).check();
    await page.getByRole("region", { name: "Selected items" }).getByRole("button", { name: "Archive" }).click();
    await expect(page.getByText("Archived 1 item", { exact: true })).toBeVisible();
    await expect(table).not.toContainText("Cement");

    // Duplicate opens Add item filled from the row.
    await table.getByRole("row", { name: /Tiling/ }).getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    const drawer = page.getByRole("dialog", { name: "Add item" });
    await expect(drawer).toContainText("A copy of another item.");
    await expect(drawer.getByLabel(/^Name/)).toHaveValue("Tiling (copy)");
    await drawer.getByRole("button", { name: "Save item" }).click();
    await expect(table).toContainText("Tiling (copy)");

    const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export" }).click()]);
    expect(file.suggestedFilename()).toMatch(/^catalogue-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync((await file.path())!, "utf8");
    expect(csv.split(/\r?\n/)[0]).toBe("Name,Description,Unit,Category,Price,Tax,HSN/SAC code,Income account,Expense account");
    expect(csv).toContain("Tiling,,each,Finishes,95.00,Sales tax 8%");
    expect(csv).not.toContain("Cement");
  });
});
