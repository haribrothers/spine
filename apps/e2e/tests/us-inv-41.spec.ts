import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { creditFirstLine, taxedInvoice } from "./credit-note-seed";

test.describe("US-INV-41", () => {
  test("search finds a credit note by its reason; the list keeps its place in the address", async ({ page }) => {
    await signUpNewOrg(page, { name: "Credit Owner", email: `e2e-inv-41-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Sahyadri Retail");
    const a = await creditFirstLine(page, (await taxedInvoice(page, c.id)).id, 1, "Canopy reduced");
    const b = await creditFirstLine(page, (await taxedInvoice(page, c.id)).id, 1, "Drainage reworked");

    await page.goto("/credit-notes");
    // Both credit the "Loading bay canopy" line, so a word of one reason tells them apart.
    await page.getByRole("searchbox", { name: "Search credit notes" }).fill("reworked");
    await expect(page).toHaveURL(/q=reworked/);
    await expect(page.getByRole("link", { name: b.number })).toBeVisible();
    await expect(page.getByRole("link", { name: a.number })).toHaveCount(0);
    await page.getByRole("link", { name: b.number }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(b.number);
    await page.goBack();
    await expect(page).toHaveURL(/q=reworked/);
    await expect(page.getByRole("link", { name: a.number })).toHaveCount(0);
    await expect(page.getByTestId("credit-notes-updated")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByRole("link", { name: a.number })).toBeVisible();
  });
});
