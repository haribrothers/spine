import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { invoice, issue } from "./invoice-seed";

test.describe("US-INV-35", () => {
  test("Duplicate opens a new draft in the builder with the same customer and lines, dated today", async ({ page }) => {
    await signUpNewOrg(page, { name: "Invoice Owner", email: `e2e-inv-35-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const source = await issue(page, (await invoice(page, c.id, { issueDays: -40, lines: [{ name: "Monthly maintenance", price: "45000" }] })).id);

    await page.goto(`/invoices/${source.id}`);
    await page.getByTestId("invoice-actions").getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Duplicate as new draft" }).click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+\/edit$/);
    await expect(page.getByText(`Duplicated from ${source.number}. Check the dates and lines, then save.`, { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Item" }).first()).toHaveValue("Monthly maintenance");
    await expect(page.getByRole("group", { name: "Due in" }).getByRole("button", { name: "+30 days" })).toHaveAttribute("aria-pressed", "true");
    expect(page.url()).not.toContain(source.id);
  });
});
