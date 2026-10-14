import type { Locator } from "@playwright/test";
import { test, expect } from "./fixtures";

const PRIMARY_LIGHT = "rgb(41, 84, 229)";
const PRIMARY_DARK = "rgb(107, 138, 255)";

/** The colours that tell a chosen option from the others. */
async function look(option: Locator) {
  return option.evaluate((el) => {
    const s = (globalThis as unknown as { getComputedStyle(e: unknown): { borderTopColor: string; color: string; fontWeight: string } }).getComputedStyle(el);
    return { border: s.borderTopColor, color: s.color, weight: s.fontWeight };
  });
}

test.describe("US-OPS-36", () => {
  test("the chosen option is a chip with a primary outline and label, the same on every screen, in light and dark", async ({ page, seededOrg: _ }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page.goto("/contacts");
    await page.getByRole("radio", { name: "Card view" }).click();
    const chosen = page.getByRole("radio", { name: "Card view" });
    await expect(chosen).toHaveAttribute("aria-checked", "true");
    // Colours ease in (transition-colors), so wait for them to settle.
    await expect.poll(() => look(chosen)).toEqual({ border: PRIMARY_LIGHT, color: PRIMARY_LIGHT, weight: "600" });
    const other = await look(page.getByRole("radio", { name: "List view" }));
    expect(other.border).not.toBe(PRIMARY_LIGHT);
    expect(other.color).not.toBe(PRIMARY_LIGHT);

    // Accrual / Cash and the chart range look the same.
    await page.goto("/dashboard");
    const accrual = page.getByRole("radio", { name: "Accrual" });
    await expect(accrual).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });
    await expect.poll(async () => (await look(accrual)).border).toBe(PRIMARY_LIGHT);
    const range = page.getByTestId("money-in-out").getByRole("radio", { name: "12M" });
    await expect(range).toHaveAttribute("aria-checked", "true");
    await expect.poll(async () => (await look(range)).color).toBe(PRIMARY_LIGHT);

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/contacts");
    const dark = page.getByRole("radio", { name: "Card view" });
    await expect(dark).toHaveAttribute("aria-checked", "true");
    await expect.poll(async () => (await look(dark)).border).toBe(PRIMARY_DARK);
  });

  test("an icon-only option shows its name as a tooltip on hover and on keyboard focus", async ({ page, seededOrg: _ }) => {
    test.setTimeout(120_000);
    await page.goto("/contacts");

    // A hover before the page is interactive goes unseen, so move away and hover again until it shows.
    await expect(async () => {
      await page.mouse.move(400, 600);
      await page.getByRole("radio", { name: "List view" }).hover();
      await expect(page.getByRole("tooltip", { name: "List view" })).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 20_000 });
    // Moving away (a real pointer keeps moving, which closes it past the tooltip's grace area).
    await page.mouse.move(400, 600);
    await page.mouse.move(420, 620);
    await expect(page.getByRole("tooltip")).toHaveCount(0);

    await page.getByRole("radio", { name: "Table view" }).focus();
    await expect(page.getByRole("tooltip", { name: "Table view" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    // The tooltip doesn't replace the accessible name.
    await expect(page.getByRole("radio", { name: "Table view" })).toBeFocused();

    await expect(async () => {
      await page.mouse.move(400, 600);
      await page.getByRole("button", { name: "Refresh list" }).hover();
      await expect(page.getByRole("tooltip", { name: "Refresh list" })).toBeVisible({ timeout: 1_500 });
    }).toPass({ timeout: 20_000 });
  });
});
