import { test, expect } from "./fixtures";
import { PHONE } from "./phone-helpers";

test.use({ viewport: PHONE });

test.describe("US-OPS-15 · keep wide tables usable on small screens", () => {
  // The every-route check (no sideways scroll, tables scroll in their own box) moved to
  // us-ops-62.spec.ts, which visits every route in routes.ts at phone width (US-OPS-62).

  // Dialogs and drawers became full-screen and bottom sheets on a phone (US-OPS-60); us-ops-60.spec.ts checks them.
  test("form fields stack on a phone", async ({ page, seededOrg: _ }) => {
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Add item" }).first().click();
    // Unit and Category share a row from 768px up; here they stack.
    const unit = (await page.locator("label", { hasText: /^Unit/ }).first().boundingBox())!;
    const category = (await page.locator("label", { hasText: /^Category/ }).first().boundingBox())!;
    expect(Math.round(unit.x)).toBe(Math.round(category.x));
    expect(category.y).toBeGreaterThan(unit.y);
  });
});
