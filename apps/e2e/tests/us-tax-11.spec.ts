import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-TAX-11", () => {
  test("items and untaxed lines have a supply type; an exempt line refuses tax", async ({ page }) => {
    await signUpNewOrg(page, { name: "Supply Owner", email: `e2e-tax-11-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    await post("/tax-rates", { name: "GST 18%", rate: 18 });
    await post("/catalog-items", { name: "Design consultation", unit: "hour", defaultPriceAmount: "500000", defaultPriceCurrency: "USD", supplyClass: "exempt" });

    // The catalogue item drawer offers the four supply types.
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Add item" }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Zero-rated, exempt and non-taxable items have no tax and are reported separately.")).toBeVisible();
    await drawer.getByRole("combobox", { name: "Supply type" }).click();
    for (const option of ["Taxable", "Zero-rated", "Exempt", "Non-taxable (outside GST/VAT)"]) await expect(page.getByRole("option", { name: option, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    // A new untaxed line is zero-rated; a line from the exempt item is exempt.
    await page.goto("/invoices/new");
    await expect(page.getByRole("combobox", { name: "Supply type" })).toHaveText("Zero-rated");
    const item = page.getByRole("combobox", { name: "Item" });
    await item.click();
    await item.fill("Design");
    await page.getByRole("listbox", { name: "Catalogue matches" }).getByRole("option", { name: /^Design consultation/ }).click();
    await expect(page.getByRole("combobox", { name: "Supply type" })).toHaveText("Exempt");

    // Picking a rate on the exempt line explains why it can't have tax.
    await page.getByRole("combobox").filter({ hasText: "No tax" }).click();
    await page.getByRole("option", { name: "GST 18% (18%)" }).click();
    await expect(page.getByText("An exempt line has no tax. Change the supply type to Taxable to add tax.")).toBeVisible();

    // Changing it to Taxable clears the message and the field goes away, as the line now has tax.
    await page.getByRole("combobox", { name: "Supply type" }).click();
    await page.getByRole("option", { name: "Taxable", exact: true }).click();
    await expect(page.getByText("An exempt line has no tax. Change the supply type to Taxable to add tax.")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Supply type" })).toHaveCount(0);
  });
});
