import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { apiPost, seedCatalog } from "./catalog-seed";

test.describe("US-CAT-11", () => {
  test("the table names the tax, flags No tax, shows the description, and badges only archived rows", async ({ page }) => {
    await signUpNewOrg(page, { name: "Catalogue Owner", email: `e2e-cat-11-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const { ids } = await seedCatalog(page, [
      { name: "Cement", price: "4100", description: "50 kg bag, delivered to site." },
      { name: "Painting", price: "2200", taxed: false },
      { name: "Old scaffold", price: "900" },
    ]);
    await apiPost(page, `/catalog-items/${ids["Old scaffold"]}/archive`, {});
    await page.goto("/catalog");

    const table = page.getByRole("table");
    await expect(table.getByRole("row", { name: /Cement/ })).toContainText("Sales tax 8%");
    await expect(table.getByRole("row", { name: /Cement/ })).toContainText("50 kg bag, delivered to site.");
    await expect(table.getByRole("row", { name: /Painting/ }).getByTestId("catalog-no-tax")).toHaveText("No tax");
    // Non-GST business: no HSN/SAC column, and no Status column — active rows carry no badge.
    await expect(table.getByRole("columnheader", { name: "HSN/SAC" })).toHaveCount(0);
    await expect(table).not.toContainText("Active");

    await page.goto("/catalog?status=active&status=archived");
    await expect(table.getByRole("row", { name: /Old scaffold/ })).toContainText("Archived");
    await expect(table.getByRole("row", { name: /Cement/ })).not.toContainText("Archived");
  });
});
