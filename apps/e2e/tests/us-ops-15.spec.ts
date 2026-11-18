import { test, expect } from "./fixtures";
import { PHONE } from "./phone-helpers";

test.use({ viewport: PHONE });

test.describe("US-OPS-15 · keep wide tables usable on small screens", () => {
  // The every-route check (no sideways scroll, tables scroll in their own box) moved to
  // us-ops-62.spec.ts, which visits every route in routes.ts at phone width (US-OPS-62).

  test("a dialog fills the width with a 16px gutter, a drawer leaves 16px, and form fields stack", async ({ page, seededOrg: _ }) => {
    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    const d = (await dialog.boundingBox())!;
    expect(Math.round(d.x)).toBe(16);
    expect(Math.round(d.width)).toBe(PHONE.width - 32);
    await page.keyboard.press("Escape");

    await page.goto("/jobs");
    await page.getByRole("button", { name: "New job" }).first().click();
    const drawer = (await page.getByTestId("new-job-drawer").boundingBox())!;
    expect(Math.round(drawer.width)).toBe(PHONE.width - 16);
    await page.keyboard.press("Escape");

    await page.goto("/catalog");
    await page.getByRole("button", { name: "Add item" }).first().click();
    // Unit and Category share a row from 768px up; here they stack.
    const unit = (await page.locator("label", { hasText: /^Unit/ }).first().boundingBox())!;
    const category = (await page.locator("label", { hasText: /^Category/ }).first().boundingBox())!;
    expect(Math.round(unit.x)).toBe(Math.round(category.x));
    expect(category.y).toBeGreaterThan(unit.y);
  });
});
