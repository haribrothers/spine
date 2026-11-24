import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { seedCatalog } from "./catalog-seed";

test.describe("US-CAT-13", () => {
  test("search, filters, price, sort and page live in the address; Refresh says when it last updated", async ({ page }) => {
    await signUpNewOrg(page, { name: "Catalogue Owner", email: `e2e-cat-13-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await seedCatalog(page, [
      { name: "Cement", price: "4100", category: "Materials" },
      { name: "Civil works", price: "3500", category: "Labour", taxed: false },
      { name: "Project management", price: "18000", category: "Labour" },
    ]);
    await page.goto("/catalog?category=Labour&setup=tax");
    const table = page.getByRole("table");
    await expect(table).toContainText("Civil works");
    await expect(table).not.toContainText("Project management");
    await expect(page.getByRole("button", { name: "Show items missing a tax rate, 1" })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/catalog$/);
    await expect(table).toContainText("Cement");

    await page.getByLabel("Search items").fill("project");
    await expect(page).toHaveURL(/q=project/);
    await expect(table).not.toContainText("Cement");
    await page.getByLabel("Search items").fill("");
    await expect(page).toHaveURL(/\/catalog$/);

    await page.getByRole("button", { name: "Filter by price" }).click();
    await page.getByLabel("Min").fill("40");
    await page.getByLabel("Max").fill("100");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/min=40&max=100/);
    await expect(page.getByRole("button", { name: /^Price filter: \$40\.00 – \$100\.00/ })).toBeVisible();
    await expect(table).toContainText("Cement");
    await expect(table).not.toContainText("Civil works");

    await page.goBack();
    await page.goForward();
    await expect(page).toHaveURL(/min=40&max=100/);

    await page.goto("/catalog");
    await page.getByRole("button", { name: /Default price/ }).click();
    await expect(page).toHaveURL(/sort=defaultPrice\.asc/);
    await page.reload();
    await expect(table.getByRole("row").nth(1)).toContainText("Civil works");

    await expect(page.getByTestId("catalog-updated")).toHaveText("Updated just now");
    await page.getByRole("button", { name: "Refresh list" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Catalogue updated" })).toHaveCount(1);
  });
});
