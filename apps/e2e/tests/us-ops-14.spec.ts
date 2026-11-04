import { test, expect } from "./fixtures";
import { PHONE, sidewaysScroll, smallControls } from "./phone-helpers";

test.use({ viewport: PHONE });

test.describe("US-OPS-14 · use the web app on a phone", () => {
  test("a top bar with the menu, logo, notifications and avatar replaces the sidebar; the navigation slides over and closes", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    const bar = page.getByTestId("app-top-bar");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("button", { name: "Open navigation" })).toBeVisible();
    await expect(bar.getByRole("button", { name: /^Notifications/ })).toBeVisible();
    await expect(bar.getByRole("button", { name: /^Your account: / })).toBeVisible();
    await expect(page.locator("aside")).toHaveCount(0);

    // Opens over a dimmed page; tapping the dimmed area closes it.
    await bar.getByRole("button", { name: "Open navigation" }).click();
    const nav = page.getByRole("dialog", { name: "Navigation" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("button", { name: "Close navigation" })).toBeVisible();
    await page.mouse.click(PHONE.width - 20, PHONE.height / 2);
    await expect(nav).toHaveCount(0);

    // The close button closes it; a link goes there and closes it.
    await bar.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: "Close navigation" }).click();
    await expect(nav).toHaveCount(0);
    await bar.getByRole("button", { name: "Open navigation" }).click();
    await nav.getByRole("link", { name: "Invoices" }).click();
    await expect(page).toHaveURL(/\/invoices$/);
    await expect(nav).toHaveCount(0);
  });

  test("the dashboard at 390px: key figures two per row, charts one per row, no sideways scroll, 44px controls", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    const cards = page.getByTestId("kpi-row").locator("[data-kpi]");
    await expect(cards.first()).toBeVisible();
    const boxes = await cards.evaluateAll((els) => els.map((el) => (el as unknown as { getBoundingClientRect(): { top: number; left: number } }).getBoundingClientRect()));
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(boxes[0]!.top - boxes[1]!.top)).toBeLessThan(2);
    expect(boxes[1]!.left).toBeGreaterThan(boxes[0]!.left);
    if (boxes[2]) expect(boxes[2].top).toBeGreaterThan(boxes[0]!.top);

    const widgets = await page.locator("[data-widget]").evaluateAll((els) => els.map((el) => (el as unknown as { getBoundingClientRect(): { left: number; width: number } }).getBoundingClientRect()));
    for (const w of widgets) expect(w.width).toBeGreaterThan(PHONE.width - 48);

    expect(await sidewaysScroll(page)).toBe(0);
    expect(await smallControls(page)).toEqual([]);

    await page.getByRole("button", { name: "Open navigation" }).click();
    expect(await smallControls(page, '[data-testid="mobile-nav"]')).toEqual([]);
  });
});
