import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";

test.describe("US-QUO-34", () => {
  test("each line is one row; Enter adds a row; rows move from the menu, with Alt + arrows, or by dragging", async ({ page }) => {
    await signUpNewOrg(page, { name: "Quote Owner", email: `e2e-quo-34-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await contact(page, "Ananya Rao");
    await page.goto("/quotes/new");

    const items = page.getByRole("combobox", { name: "Item" });
    await items.first().fill("Demolition");
    await page.getByLabel("Unit price").first().fill("180.00");
    // An untaxed line shows its supply type, so its description row is open already.
    await page.getByLabel("Description").first().fill("Remove old tiles");

    // Enter in the last row's tax adds a row with its Item field focused.
    await page.getByRole("combobox", { name: "Tax" }).first().focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(items).toHaveCount(2);
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(items).toHaveCount(3);
    await expect(items.nth(2)).toBeFocused();
    await items.nth(1).fill("Waterproofing");
    await items.nth(2).fill("Tiling");

    const names = async () => (await items.all()).map(async (i) => i.inputValue());
    const order = async () => Promise.all(await names());
    expect(await order()).toEqual(["Demolition", "Waterproofing", "Tiling"]);

    // Alt + ↑ moves a row up, and says so.
    await items.nth(2).focus();
    await page.keyboard.press("Alt+ArrowUp");
    expect(await order()).toEqual(["Demolition", "Tiling", "Waterproofing"]);
    await expect(page.getByRole("status").filter({ hasText: "Moved to position 2 of 3" })).toHaveCount(1);

    // The row's menu.
    await page.getByRole("button", { name: "Actions for line 1" }).click();
    await page.getByRole("menuitem", { name: "Move down" }).click();
    expect(await order()).toEqual(["Tiling", "Demolition", "Waterproofing"]);

    // Dragging the handle.
    await page.getByRole("button", { name: "Drag line 3" }).dragTo(page.getByRole("group", { name: "Line 1 of 3" }), { targetPosition: { x: 40, y: 4 } });
    expect(await order()).toEqual(["Waterproofing", "Tiling", "Demolition"]);

    await page.getByRole("button", { name: "Actions for line 3" }).click();
    await page.getByRole("menuitem", { name: "Remove line" }).click();
    await expect(items).toHaveCount(2);
  });
});
