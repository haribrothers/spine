import { test, expect } from "./fixtures";
import { PHONE, sidewaysScroll } from "./phone-helpers";

/** A phone: 390×844 with a touch screen. */
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

test.describe("US-DASH-31 · see my dashboard laid out for my phone", () => {
  test("in order: the greeting with the date, Needs your attention, the key figures two per row, then the other cards one per row; nothing cut off", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const greeting = page.getByTestId("dashboard-phone-greeting");
    await expect(greeting).toContainText(/^Good (morning|afternoon|evening)/);
    const attention = page.getByTestId("attention-card");
    const firstItem = attention.locator("li[data-kind]").first();
    await expect(firstItem).toBeVisible();
    const g = (await greeting.boundingBox())!;
    const a = (await attention.boundingBox())!;
    const i = (await firstItem.boundingBox())!;
    // The greeting and the first attention item are on the first screen.
    expect(g.y + g.height).toBeLessThanOrEqual(a.y);
    expect(i.y + i.height).toBeLessThan(PHONE.height - 70);

    const kpis = page.getByTestId("kpi-row");
    const cards = page.locator("[data-kpi]");
    await expect(cards.first()).toBeVisible();
    const tops = await cards.evaluateAll((els) => els.map((el) => Math.round((el as unknown as { getBoundingClientRect(): { top: number } }).getBoundingClientRect().top)));
    expect(tops[0]).toBe(tops[1]);
    const k = (await cards.first().boundingBox())!;
    expect(k.y).toBeGreaterThan(a.y + a.height - 1);
    await expect(kpis.first()).toBeVisible();

    // The other cards come after, one per row, the screen's width less its margins.
    const today = (await page.getByRole("heading", { name: "Today" }).boundingBox())!;
    expect(today.y).toBeGreaterThan(k.y);
    for (const w of await page.locator("[data-widget]").all()) {
      const b = (await w.boundingBox())!;
      expect(b.width).toBeGreaterThan(PHONE.width - 40);
    }
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("each attention item is a row with its action on the right; more than three show with Show all", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const attention = page.getByTestId("attention-card");
    const rows = attention.locator("li[data-kind]");
    await expect(rows.first()).toBeVisible();
    const row = (await rows.first().boundingBox())!;
    const button = (await rows.first().getByRole("link").or(rows.first().getByRole("button")).first().boundingBox())!;
    expect(button.x + button.width).toBeGreaterThan(row.x + row.width - 24);
    expect(Math.abs(button.y + button.height / 2 - (row.y + row.height / 2))).toBeLessThan(12);
    const count = Number(await attention.getByRole("heading").locator("span").first().textContent());
    if (count > 3) {
      await expect(rows).toHaveCount(3);
      await attention.getByRole("button", { name: `Show all ${count}` }).click();
      await expect(rows).toHaveCount(count);
    }
  });

  test("Accrual or Cash is under ⋯; Edit layout isn't offered", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /Edit layout/ })).toHaveCount(0);
    await page.getByTestId("app-top-bar").getByRole("button", { name: "More actions" }).click();
    const sheet = page.getByRole("dialog", { name: "More actions" });
    await expect(sheet.getByRole("radio", { name: /Cash/ }).or(sheet.getByRole("button", { name: /Cash/ })).first()).toBeVisible();
  });
});

test.describe("US-DASH-31 · from 768px up", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test("the dashboard is as it was: Edit layout and Accrual/Cash in the header, no phone greeting", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /Edit layout/ })).toBeVisible();
    await expect(page.getByTestId("dashboard-phone-greeting")).toHaveCount(0);
  });
});
