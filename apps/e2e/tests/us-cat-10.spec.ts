import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { seedCatalog } from "./catalog-seed";

test.describe("US-CAT-10", () => {
  test("the cards count what needs setting up and filter to it; Total items clears", async ({ page }) => {
    await signUpNewOrg(page, { name: "Catalogue Owner", email: `e2e-cat-10-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await seedCatalog(page, [
      { name: "Cement", price: "4100", category: "Materials" },
      { name: "Painting", price: "2200", category: "Finishes", taxed: false },
      { name: "Project management", price: "18000", category: "Labour" },
    ]);
    await page.goto("/catalog");
    const stats = page.getByTestId("catalog-stats");
    await expect(stats).toContainText("Total items3");
    await expect(stats).toContainText("Categories3Finishes, Labour and 1 more");
    await expect(stats).toContainText("No income account3Posts to 4100 Sales — Services");

    const missing = page.getByRole("button", { name: "Show items missing a tax rate, 1" });
    await expect(missing).toHaveAttribute("aria-pressed", "false");
    await missing.click();
    await expect(missing).toHaveAttribute("aria-pressed", "true");
    await expect(missing).toContainText("Showing these · press again to clear");
    await expect(page).toHaveURL(/setup=tax/);
    await expect(page.getByRole("table")).toContainText("Painting");
    await expect(page.getByRole("table")).not.toContainText("Cement");

    await missing.click();
    await expect(missing).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("table")).toContainText("Cement");

    await page.getByRole("button", { name: "Show items with no income account, 3" }).click();
    await expect(page).toHaveURL(/setup=account/);
    await page.getByRole("button", { name: /^Clear the filters, 3/ }).click();
    await expect(page).not.toHaveURL(/setup=/);
    await expect(page.getByRole("button", { name: "Show items with no income account, 3" })).toHaveAttribute("aria-pressed", "false");
  });
});
