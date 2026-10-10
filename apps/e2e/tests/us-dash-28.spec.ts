import { randomUUID } from "node:crypto";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

async function indianOrg(page: Page) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-dash-28-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const res = await page.request.post(`${API_URL}/demo-data/seed`, { headers: { "Idempotency-Key": randomUUID() }, data: { country: "IN", industry: "construction" } });
  expect(res.ok()).toBe(true);
}

/** Shown whole on one line, inside its card (and inside `within`, when given). */
async function expectOneLine(el: Locator, within?: Locator) {
  const fits = await el.evaluate((node) => {
    // This project has no DOM types; the browser has these.
    const n = node as unknown as { getClientRects(): ArrayLike<{ top: number }>; scrollWidth: number; clientWidth: number };
    const rects = Array.from(n.getClientRects());
    return { lines: new Set(rects.map((r) => Math.round(r.top))).size, overflow: n.scrollWidth - n.clientWidth };
  });
  expect(fits.lines).toBe(1);
  expect(fits.overflow).toBeLessThanOrEqual(0);
  if (within) {
    const [box, outer] = await Promise.all([el.boundingBox(), within.boundingBox()]);
    expect(box!.x + box!.width).toBeLessThanOrEqual(outer!.x + outer!.width + 0.5);
  }
}

test.describe("US-DASH-28", () => {
  test("KPI cards have an icon chip and a soft tint, and big figures fit whole at 1280 px", async ({ page }) => {
    test.setTimeout(120_000);
    await indianOrg(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/dashboard");

    const row = page.getByTestId("kpi-row");
    await expect(row).toBeVisible({ timeout: 15_000 });
    const plain = await page.getByTestId("accounts-card").evaluate((el) => (globalThis as unknown as { getComputedStyle(e: unknown): { backgroundColor: string; animationName: string } }).getComputedStyle(el).backgroundColor);
    const tints = new Set<string>();
    for (const key of ["cash", "profit", "receivables", "overdue"]) {
      const card = row.locator(`[data-kpi="${key}"]`);
      await expect(card.getByTestId("kpi-chip").locator("svg")).toBeVisible();
      const tint = await card.evaluate((el) => (globalThis as unknown as { getComputedStyle(e: unknown): { backgroundColor: string; animationName: string } }).getComputedStyle(el).backgroundColor);
      expect(tint).not.toBe(plain);
      tints.add(tint);
      const figure = card.getByTestId("kpi-figure");
      await expect(figure).toContainText(/₹[\d,]+\.\d{2}/);
      await expectOneLine(figure);
    }
    expect(tints.size).toBe(4);
  });

  test("Payables and Tax this period stack their figures, the ring shows the short total, and amounts stay on one line", async ({ page }) => {
    test.setTimeout(120_000);
    await indianOrg(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/dashboard");
    await expect(page.getByTestId("kpi-row")).toBeVisible({ timeout: 15_000 });

    for (const id of ["payables-card", "tax-period"]) {
      const trio = page.getByTestId(id).getByTestId("figure-trio");
      await expect(trio).toBeVisible();
      const cells = trio.locator(":scope > *");
      await expect(cells).toHaveCount(3);
      const boxes = await cells.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), y: Math.round(r.y) })));
      // Stacked: one above the other, not side by side.
      expect(new Set(boxes.map((b) => b.x)).size).toBe(1);
      expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
      for (const value of await trio.locator(".tabular-nums").all()) await expectOneLine(value, trio);
    }

    const aging = page.getByTestId("ar-aging");
    await expect(aging).toContainText(/₹\d+(\.\d)?(L|K|Cr)/);
    await expect(aging.getByTestId("aging-total")).toContainText(/Total ₹[\d,]+\.\d{2}/);

    const profitability = page.getByTestId("job-profitability");
    const amounts = profitability.locator(".tabular-nums");
    await expect(amounts.first()).toBeVisible();
    for (const amount of await amounts.all()) await expectOneLine(amount, profitability);
  });
});
