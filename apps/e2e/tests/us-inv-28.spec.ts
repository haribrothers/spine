import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { invoice, issue } from "./invoice-seed";

test.describe("US-INV-28", () => {
  test("search finds an invoice by a line's name; the search and filters stay in the address", async ({ page }) => {
    await signUpNewOrg(page, { name: "Invoice Owner", email: `e2e-inv-28-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const canopy = await issue(page, (await invoice(page, c.id, { lines: [{ name: "Loading bay canopy", price: "50000" }] })).id);
    const drainage = await issue(page, (await invoice(page, c.id, { lines: [{ name: "Storm-water drainage", price: "30000" }] })).id);

    await page.goto("/invoices");
    await page.getByRole("searchbox", { name: "Search invoices" }).fill("canopy");
    await expect(page).toHaveURL(/q=canopy/);
    await expect(page.getByRole("link", { name: canopy.number })).toBeVisible();
    await expect(page.getByRole("link", { name: drainage.number })).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("searchbox", { name: "Search invoices" })).toHaveValue("canopy");
    await expect(page.getByRole("link", { name: drainage.number })).toHaveCount(0);

    // The page's address comes back after opening an invoice.
    await page.getByRole("link", { name: canopy.number }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(canopy.number);
    await page.goBack();
    await expect(page).toHaveURL(/q=canopy/);
    await expect(page.getByTestId("invoices-updated")).toBeVisible();
  });
});
