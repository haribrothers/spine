import { test, expect } from "./fixtures";
import { PHONE } from "./phone-helpers";

/** A phone: 390×844 with a touch screen. */
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

/** List pages with a main action, and its label. */
const MAIN_ACTIONS: [string, RegExp][] = [
  ["/invoices", /^New invoice$/],
  ["/quotes", /^New quote$/],
  ["/jobs", /^New job$/],
  ["/payments", /^Record payment$/],
  ["/contacts", /^Add contact$/],
  ["/expenses", /^Submit expense$/],
  ["/vendor-bills", /^New vendor bill$/],
  ["/catalog", /^Add item$/],
];

test.describe("US-OPS-57 · see a list's figures, filters and main action on the first screen", () => {
  test("the summary cards are chips in one row that scrolls sideways; tapping one filters; the first rows are on the first screen", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    const strip = page.getByTestId("invoice-stats");
    const chips = await strip.locator("[data-stat-card]").evaluateAll((els) =>
      els.map((el) => {
        const r = (el as unknown as { getBoundingClientRect(): { top: number; height: number } }).getBoundingClientRect();
        return { top: Math.round(r.top), height: Math.round(r.height) };
      }),
    );
    expect(chips.length).toBeGreaterThan(2);
    expect(new Set(chips.map((c) => c.top)).size).toBe(1);
    for (const c of chips) expect(c.height).toBeLessThan(80);
    expect(await strip.evaluate((el) => (el as unknown as { scrollWidth: number; clientWidth: number }).scrollWidth > (el as unknown as { clientWidth: number }).clientWidth)).toBe(true);
    // The first rows of the list are on the first screen.
    const firstRow = (await page.getByTestId("phone-list").locator("li[data-list-row]").first().boundingBox())!;
    expect(firstRow.y + firstRow.height).toBeLessThan(PHONE.height - 70);
    // A chip still filters the list.
    await strip.getByRole("button", { pressed: false }).nth(1).click();
    await expect(strip.getByRole("button", { pressed: true })).toHaveCount(1);
  });

  test("one row of search and Filters; Filters opens every filter with Show results and Clear all; each filter that's on is a chip with ×", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    const row = page.getByTestId("filter-sheet-row");
    const search = (await row.getByRole("searchbox").or(row.getByRole("textbox")).first().boundingBox())!;
    const filters = (await row.getByRole("button", { name: /^Filters/ }).boundingBox())!;
    expect(Math.abs(search.y - filters.y)).toBeLessThan(6);

    await row.getByRole("button", { name: /^Filters/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Clear all" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /^Show \d+ invoices?$/ })).toBeVisible();
    await sheet.getByRole("combobox", { name: "Filter by status" }).click();
    await page.getByRole("option", { name: "Overdue" }).click();
    await page.keyboard.press("Escape");
    await sheet.getByRole("button", { name: /^Show / }).click();
    await expect(sheet).toHaveCount(0);

    await expect(row.getByRole("button", { name: /^Filters/ })).toContainText("1");
    const chip = row.getByRole("button", { name: "Remove Overdue" });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(row.getByRole("button", { name: "Remove Overdue" })).toHaveCount(0);
  });

  test("the main action floats above the tab bar with its label, shrinking to + while the list scrolls; other actions are under ⋯", async ({ page, seededOrg: _ }) => {
    let shrunk = 0;
    for (const [path, label] of MAIN_ACTIONS) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const fab = page.locator("[data-main-action]");
      const button = fab.getByRole("link", { name: label }).or(fab.getByRole("button", { name: label })).first();
      await expect(button, path).toBeVisible();
      const b = (await button.boundingBox())!;
      const bar = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
      expect(b.y + b.height, path).toBeLessThanOrEqual(bar.y);
      expect(b.x + b.width, path).toBeGreaterThan(PHONE.width - 40);

      // Only a list long enough to scroll can shrink it.
      const scrolls = await page.getByRole("main").evaluate((el) => {
        const m = el as unknown as { scrollTop: number; scrollHeight: number; clientHeight: number };
        m.scrollTop = 200;
        return m.scrollHeight > m.clientHeight + 10;
      });
      if (!scrolls) continue;
      await expect(fab, path).toHaveAttribute("data-compact", "true");
      // Its label is still its name.
      await expect(button, path).toHaveAccessibleName(label);
      expect((await button.boundingBox())!.width, path).toBeLessThan(60);
      shrunk++;
    }
    expect(shrunk).toBeGreaterThan(0);

    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    // Scrolled to the end, the last row isn't under the floating button.
    await page.getByRole("main").evaluate((el) => {
      const m = el as unknown as { scrollTop: number; scrollHeight: number };
      m.scrollTop = m.scrollHeight;
    });
    await page.waitForTimeout(700);
    const lastRow = (await page.getByTestId("phone-list").locator("li[data-list-row]").last().boundingBox())!;
    const fabBox = (await page.locator("[data-main-action] > *").first().boundingBox())!;
    expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(fabBox.y);
    await page.getByTestId("app-top-bar").getByRole("button", { name: "More actions" }).click();
    const more = page.getByRole("dialog", { name: "More actions" });
    await expect(more.getByRole("button", { name: "Refresh list" })).toBeVisible();
    await expect(more.getByRole("link", { name: "Recurring invoices" })).toBeVisible();

    // Export is under ⋯ too, and its menu opens from there.
    await page.goto("/receivables");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("app-top-bar").getByRole("button", { name: "More actions" }).click();
    await page.getByRole("dialog", { name: "More actions" }).getByTestId("export-menu").click();
    await expect(page.getByRole("menuitem", { name: "CSV" })).toBeVisible();
  });
});

test.describe("US-OPS-57 · from 768px up", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test("cards, filters and buttons are where they were", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("combobox", { name: "Filter by status" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Filters/ })).toHaveCount(0);
    await expect(page.locator("[data-main-action]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "New invoice" })).toBeVisible();
  });
});
