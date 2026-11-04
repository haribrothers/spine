import { test, expect } from "./fixtures";
import { PHONE, sidewaysScroll } from "./phone-helpers";

test.use({ viewport: PHONE });

/** Every app route with a list or table (route-smoke's, plus the dashboard, quotes and reports). */
const ROUTES = [
  "/dashboard", "/contacts", "/leads", "/catalog", "/quotes", "/jobs", "/meetings", "/invoices", "/credit-notes", "/emails", "/payments",
  "/receivables", "/vendor-bills", "/expenses", "/vendor-payments", "/payables", "/reports", "/team/users", "/team/teams",
];

test.describe("US-OPS-15 · keep wide tables usable on small screens", () => {
  test("at 390×844 no page scrolls sideways; a table wider than the screen scrolls inside its own box", async ({ page, seededOrg: _ }) => {
    test.setTimeout(180_000);
    for (const path of ROUTES) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect({ path, sideways: await sidewaysScroll(page) }).toEqual({ path, sideways: 0 });
      const tables = await page.locator("table").evaluateAll((els) =>
        els.map((el) => {
          type El = { scrollWidth: number; clientWidth: number; parentElement: El | null };
          const t = el as unknown as El;
          let box = t.parentElement;
          while (box && box.scrollWidth <= box.clientWidth) box = box.parentElement;
          return { width: t.scrollWidth, boxWidth: box?.clientWidth ?? 0 };
        }),
      );
      for (const t of tables) if (t.width > PHONE.width) expect({ path, fits: t.boxWidth <= PHONE.width }).toEqual({ path, fits: true });
    }
  });

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
