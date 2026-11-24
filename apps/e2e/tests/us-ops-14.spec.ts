import { test, expect } from "./fixtures";
import { PHONE, sidewaysScroll, smallControls } from "./phone-helpers";

test.use({ viewport: PHONE });

test.describe("US-OPS-14 · use the web app on a phone", () => {
  // The top bar and slide-over menu were replaced by tabs along the bottom (US-OPS-54, D-283):
  // us-ops-54.spec.ts checks the phone shell now.

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

    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "More" }).click();
    expect(await smallControls(page, '[data-testid="more-sheet"]')).toEqual([]);
  });
});
