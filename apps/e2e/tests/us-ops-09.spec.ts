import { test, expect } from "./fixtures";
import type { Locator } from "@playwright/test";

/** The longest animation or transition on the element, in ms, read in the browser (this project has no DOM types). */
async function longestMotionMs(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    type Style = { animationDuration: string; transitionDuration: string; animationName: string };
    const style = (globalThis as unknown as { getComputedStyle(e: unknown): Style }).getComputedStyle(el);
    const ms = (list: string) => list.split(",").map((v) => (v.trim().endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000));
    const animations = style.animationName === "none" ? [0] : ms(style.animationDuration);
    return Math.max(...animations, ...ms(style.transitionDuration));
  });
}

test.describe("US-OPS-09 · respect reduced-motion settings everywhere", () => {
  test("with reduced motion, the palette, menus, toasts and the sidebar appear in their final state at once", async ({ page, seededOrg: _ }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dashboard");
    await expect(page.getByRole("main")).toBeVisible();

    // A dialog: the search palette.
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Search" });
    await expect(palette).toBeVisible();
    expect(await longestMotionMs(palette)).toBeLessThan(1);
    await page.keyboard.press("Escape");

    // A popover menu: the account menu.
    await page.getByRole("button", { name: /^Your account: / }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    expect(await longestMotionMs(menu)).toBeLessThan(1);
    await page.keyboard.press("Escape");

    // A toast: the "you can't do that" one, from the app's one host.
    await page.evaluate(() => (globalThis as unknown as { dispatchEvent(e: Event): boolean }).dispatchEvent(new Event("spine:forbidden")));
    const toast = page.locator('[data-testid="permission-toast"]').first();
    await expect(toast).toBeVisible();
    expect(await longestMotionMs(toast)).toBeLessThan(1);

    // The sidebar collapses without sliding, and the final state is clear.
    expect(await longestMotionMs(page.locator("aside").first())).toBeLessThan(1);
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" }).first()).toBeVisible();
  });

  test("without reduced motion, toasts still animate in (the rule is scoped to the setting)", async ({ page, seededOrg: _ }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/dashboard");
    await expect(page.getByRole("main")).toBeVisible();
    await page.evaluate(() => (globalThis as unknown as { dispatchEvent(e: Event): boolean }).dispatchEvent(new Event("spine:forbidden")));
    const toast = page.locator('[data-testid="permission-toast"]').first();
    await expect(toast).toBeVisible();
    expect(await longestMotionMs(toast)).toBeGreaterThanOrEqual(150);
  });
});
