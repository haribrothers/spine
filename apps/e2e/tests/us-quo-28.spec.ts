import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact, quote, send } from "./quote-seed";

test.describe("US-QUO-28", () => {
  test("search, status and contact live in the address; Contact lists only contacts with a quote; Refresh", async ({ page }) => {
    await signUpNewOrg(page, { name: "Quote Owner", email: `e2e-quo-28-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const ananya = await contact(page, "Ananya Rao");
    const halcyon = await contact(page, "Halcyon Tech Parks");
    await contact(page, "Nobody Quoted");
    const a = await quote(page, ananya.id, { title: "Bathroom refit", lines: [{ name: "Floor tiling", price: "95000" }] });
    await send(page, a.id);
    await quote(page, halcyon.id, { title: "Storm-water drainage", lines: [{ name: "Drainage", price: "240000" }] });

    await page.goto("/quotes");
    const table = page.getByRole("table");
    await page.getByLabel("Search quotes").fill("tiling");
    await expect(page).toHaveURL(/q=tiling/);
    await expect(table).toContainText("Bathroom refit");
    await expect(table).not.toContainText("Storm-water drainage");
    await page.reload();
    await expect(page.getByLabel("Search quotes")).toHaveValue("tiling");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/quotes$/);

    await page.getByRole("combobox", { name: "Filter by contact" }).click();
    await expect(page.getByRole("option", { name: "Halcyon Tech Parks" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Nobody Quoted" })).toHaveCount(0);
    await page.getByRole("option", { name: "Halcyon Tech Parks" }).click();
    await expect(page).toHaveURL(new RegExp(`contact=${halcyon.id}`));
    await expect(table).toContainText("Storm-water drainage");
    await expect(table).not.toContainText("Bathroom refit");

    await page.goto("/quotes?status=sent");
    await expect(table).toContainText("Bathroom refit");
    await expect(table).not.toContainText("Storm-water drainage");

    await expect(page.getByTestId("quotes-updated")).toHaveText("Updated just now");
    await page.getByRole("button", { name: "Refresh list" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Quotes updated" })).toHaveCount(1);
  });
});
