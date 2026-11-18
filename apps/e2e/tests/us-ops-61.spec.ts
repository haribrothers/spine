import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PHONE } from "./phone-helpers";

/** A phone: 390×844 with a touch screen, so `pointer: coarse` matches. */
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

type Box = { x: number; y: number; width: number; height: number };

async function boxes(locator: Locator): Promise<Box[]> {
  return locator.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }),
  );
}

/** Pairs of boxes that overlap by more than a pixel. */
function overlaps(list: Box[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (w > 1 && h > 1) out.push(`${i}×${j}`);
    }
  return out;
}

/** The triggers of the first tab row: one line (same top), none wrapped onto two lines, none on another. */
async function expectOneRowOfTabs(page: Page) {
  const tablist = page.getByRole("tablist").first();
  await expect(tablist).toBeVisible();
  const tabs = await boxes(tablist.getByRole("tab"));
  expect(tabs.length).toBeGreaterThan(2);
  const tops = new Set(tabs.map((b) => Math.round(b.y)));
  expect(tops.size).toBe(1);
  // A label on one line: the trigger is no taller than the 44px tap height.
  for (const b of tabs) expect(b.height).toBeLessThanOrEqual(46);
  expect(overlaps(tabs)).toEqual([]);
  // The row scrolls inside its own box; the page doesn't.
  const row = await tablist.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, right: el.getBoundingClientRect().right }));
  expect(row.right).toBeLessThanOrEqual(PHONE.width);
}

async function firstHref(page: Page, prefix: string): Promise<string> {
  const href = await page.locator(`a[href^="${prefix}"]`).first().getAttribute("href");
  expect(href).toBeTruthy();
  return href!;
}

test.describe("US-OPS-61 · fix what's broken on a phone today", () => {
  test("a job's tabs are one row: no label or count overlaps another or wraps", async ({ page, seededOrg: _ }) => {
    await page.goto("/jobs");
    await page.waitForLoadState("networkidle");
    await page.goto(await firstHref(page, "/jobs/"));
    await expect(page.getByRole("tab", { name: /^Milestones/ })).toBeVisible();
    await expectOneRowOfTabs(page);
  });

  test("an invoice's Edit, Preview PDF and Issue invoice fit inside the screen", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    await page.getByText("Draft", { exact: true }).first().click();
    await page.waitForURL(/\/invoices\/.+/);
    const actions = page.getByTestId("invoice-actions");
    for (const name of [/^Edit$/, /^Preview PDF$/, /^Issue invoice$/, /^More/]) {
      const b = (await actions.getByRole("button", { name }).or(actions.getByRole("link", { name })).first().boundingBox())!;
      expect({ name: name.source, left: b.x >= 0, right: b.x + b.width <= PHONE.width }).toEqual({ name: name.source, left: true, right: true });
    }
  });

  test("a record's breadcrumb sits on one line, the middle item shortened if needed", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    await page.getByText("Draft", { exact: true }).first().click();
    await page.waitForURL(/\/invoices\/.+/);
    const crumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(crumb).toBeVisible();
    // Each item's text sits on the same line: their vertical centres agree.
    const texts = await crumb.evaluate((nav) => {
      type El = { getBoundingClientRect(): { y: number; height: number; right: number } };
      const root = nav as unknown as { querySelectorAll(s: string): ArrayLike<El> };
      const style = (globalThis as unknown as { getComputedStyle(el: El): { lineHeight: string } }).getComputedStyle;
      return Array.from(root.querySelectorAll("a span, nav > span")).map((el) => {
        const r = el.getBoundingClientRect();
        return { centre: r.y + r.height / 2, right: r.right, lines: Math.round(r.height / (parseFloat(style(el).lineHeight) || 18)) };
      });
    });
    expect(texts.length).toBe(3);
    const centres = texts.map((t) => t.centre);
    expect(Math.max(...centres) - Math.min(...centres)).toBeLessThan(2);
    for (const t of texts) {
      expect(t.lines).toBeLessThanOrEqual(1);
      expect(t.right).toBeLessThanOrEqual(PHONE.width);
    }
  });

  test("the invoice list's selection column has no empty boxes", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    const checks = await boxes(page.locator("table").getByRole("checkbox"));
    expect(checks.length).toBeGreaterThan(0);
    // A checkbox keeps its own size (its 44px tap area is drawn around it, not as a blank box).
    for (const b of checks) expect(Math.max(b.width, b.height)).toBeLessThanOrEqual(24);
  });

  test("on a touch screen the search field shows no ⌘K hint", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    await page.getByTestId("app-top-bar").getByRole("button", { name: "Open navigation" }).click();
    const nav = page.getByRole("dialog", { name: "Navigation" });
    await expect(nav.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(nav.getByTestId("search-shortcut")).toBeHidden();
    await expect(nav.getByText(/⌘K|Ctrl K/)).toBeHidden();
  });

  test("a report's tabs are one row that scrolls sideways", async ({ page, seededOrg: _ }) => {
    await page.goto("/reports/profit-and-loss");
    await expect(page.getByRole("tab", { name: "Profit & Loss" })).toBeVisible();
    await expectOneRowOfTabs(page);
  });
});

test.describe("US-OPS-61 · the desktop is unchanged", () => {
  test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false });

  test("with a mouse the search field still shows its shortcut", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("search-shortcut").first()).toBeVisible();
  });
});
