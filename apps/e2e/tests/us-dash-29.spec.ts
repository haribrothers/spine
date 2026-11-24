import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

async function indianOrg(page: Page) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-dash-29-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const res = await page.request.post(`${API_URL}/demo-data/seed`, { headers: { "Idempotency-Key": randomUUID() }, data: { country: "IN", industry: "construction" } });
  expect(res.ok()).toBe(true);
}

async function waitForCards(page: Page) {
  await expect(page.getByTestId("kpi-row")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("dashboard-grid").getByTestId("widget-skeleton")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(500);
}

/** The browser's own element shapes; this project has no DOM types. */
interface Rect {
  x: number;
  top: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}
interface Box {
  children: ArrayLike<Box>;
  firstElementChild: Box | null;
  getBoundingClientRect(): Rect;
  getAttribute(name: string): string | null;
}

/**
 * The grid's cards by column, top to bottom, with the space between each
 * card and the one above it. A wide card counts in every column it covers.
 */
async function columnGaps(page: Page) {
  return page.getByTestId("dashboard-grid").evaluate((node) => {
    const grid = node as unknown as Box;
    const cards = Array.from(grid.children)
      .map((el) => ({ el, r: el.firstElementChild?.getBoundingClientRect() }))
      .filter((c): c is { el: Box; r: Rect } => !!c.r && c.r.height > 0);
    const narrow = Math.min(...cards.map((c) => c.r.width));
    const columns = [...new Set(cards.filter((c) => c.r.width <= narrow + 1).map((c) => Math.round(c.r.x)))].sort((a, b) => a - b);
    const top = grid.getBoundingClientRect().top;
    return columns.map((x) => {
      const inColumn = cards.filter((c) => Math.round(c.r.x) <= x && Math.round(c.r.right) >= x + narrow - 1).sort((a, b) => a.r.top - b.r.top);
      return inColumn.map((c, i) => ({
        key: c.el.getAttribute("data-widget"),
        gap: Math.round(c.r.top - (i === 0 ? top : inColumn[i - 1]!.r.bottom)),
      }));
    });
  });
}

test.describe("US-DASH-29", () => {
  test("from 1440 px tasks and recent activity sit in a side column, the chart comes first, and cards pack with no gaps", async ({ page }) => {
    test.setTimeout(120_000);
    await indianOrg(page);
    await page.setViewportSize({ width: 1440, height: 1400 });
    await page.goto("/dashboard");
    await waitForCards(page);

    const side = page.getByTestId("dashboard-side");
    const grid = page.getByTestId("dashboard-grid");
    const [sideBox, gridBox] = await Promise.all([side.boundingBox(), grid.boundingBox()]);
    expect(sideBox!.x).toBeGreaterThanOrEqual(gridBox!.x + gridBox!.width);
    expect(sideBox!.width).toBeGreaterThan(320);
    expect(sideBox!.width).toBeLessThan(360);
    for (const id of ["attention-card", "today-card", "activity-feed"]) await expect(side.getByTestId(id)).toBeVisible();
    await expect(grid.getByTestId("activity-feed")).toHaveCount(0);

    // Two columns; Income and expenses spans both at the top; every card sits right under the one above it.
    const columns = await columnGaps(page);
    expect(columns).toHaveLength(2);
    for (const column of columns) {
      expect(column[0]!.key).toBe("money-in-out");
      expect(column[0]!.gap).toBeLessThanOrEqual(1);
      for (const card of column.slice(1)) expect(card.gap, `${card.key} sits under the card above it`).toBeLessThanOrEqual(24);
    }

    // The side column stays in view while the page scrolls (it fits this window).
    await expect(side).toHaveAttribute("data-sticky", "true");
    await page.getByRole("main").evaluate((main) => main.scrollTo(0, 900));
    await expect(side.getByTestId("attention-card")).toBeInViewport();

    // Keyboard and screen readers: tasks first, then the KPI row, then the cards.
    const order = await page.evaluate(`(() => {
      const at = (id) => document.querySelector('[data-testid="' + id + '"]');
      const before = (a, b) => !!(at(a).compareDocumentPosition(at(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      return [before("attention-card", "today-card"), before("today-card", "kpi-row"), before("kpi-row", "dashboard-grid")];
    })()`);
    expect(order).toEqual([true, true, true]);

    // Edit layout keeps Recent activity in the grid, so it can still be hidden.
    await page.getByRole("main").evaluate((main) => main.scrollTo(0, 0));
    await page.getByRole("button", { name: "Edit layout" }).click();
    const activityCell = grid.locator('[data-widget="activity-feed"]');
    await expect(activityCell).toBeVisible();
    await expect(activityCell.getByRole("button", { name: "Hide widget" })).toBeVisible();
    await expect(side.getByTestId("activity-feed")).toHaveCount(0);
    await page.getByRole("button", { name: "Done" }).click();
  });

  test("below 1440 px tasks stay on top at the same height, and the cards use three columns at 1280 px with no gaps", async ({ page }) => {
    test.setTimeout(120_000);
    await indianOrg(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/dashboard");
    await waitForCards(page);

    const [attention, today, kpis] = await Promise.all([page.getByTestId("attention-card").boundingBox(), page.getByTestId("today-card").boundingBox(), page.getByTestId("kpi-row").boundingBox()]);
    expect(Math.round(attention!.y)).toBe(Math.round(today!.y));
    expect(Math.round(attention!.height)).toBe(Math.round(today!.height));
    expect(today!.x).toBeGreaterThan(attention!.x + attention!.width);
    expect(kpis!.y).toBeGreaterThan(attention!.y + attention!.height);
    await expect(page.getByTestId("dashboard-grid").getByTestId("activity-feed")).toBeVisible();

    const columns = await columnGaps(page);
    expect(columns).toHaveLength(3);
    for (const column of columns) for (const card of column.slice(1)) expect(card.gap, `${card.key} sits under the card above it`).toBeLessThanOrEqual(24);
  });
});
