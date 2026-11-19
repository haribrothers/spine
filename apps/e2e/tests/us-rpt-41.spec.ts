import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PHONE, sidewaysScroll } from "./phone-helpers";

/** A phone: 390×844 with a touch screen. */
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.describe("US-RPT-41 · read reports on my phone", () => {
  test("the filters are one line saying what's chosen, which opens every filter in a sheet; Export is under ⋯; the sibling reports' tabs are one row", async ({ page, seededOrg: _ }) => {
    await open(page, "/reports/profit-and-loss");
    const line = page.getByTestId("report-filter-summary");
    await expect(line).toContainText(/\w{3} \d{1,2} – \w{3} \d{1,2}, \d{4} · Accrual · No comparison/);
    await line.click();
    const sheet = page.getByRole("dialog", { name: "Report filters" });
    await expect(sheet.getByText("From")).toBeVisible();
    await expect(sheet.getByText("Compare with")).toBeVisible();
    await expect(sheet.getByText("Basis")).toBeVisible();
    await sheet.getByRole("button", { name: "Show report" }).click();
    await expect(sheet).toHaveCount(0);

    await page.getByTestId("app-top-bar").getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("dialog", { name: "More actions" }).getByTestId("export-menu")).toBeVisible();
    await page.keyboard.press("Escape");

    const tabs = page.getByRole("tablist").first();
    const scrolls = await tabs.evaluate((el) => (el as unknown as { scrollWidth: number; clientWidth: number }).scrollWidth > (el as unknown as { clientWidth: number }).clientWidth);
    expect(scrolls).toBe(true);
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("the cards are chips in one row; the chart is the screen's width with its legend under it", async ({ page, seededOrg: _ }) => {
    await open(page, "/reports/profit-and-loss");
    const cards = page.locator("[data-slot=report-kpis] [data-stat-card]");
    await expect(cards.first()).toBeVisible();
    const tops = await cards.evaluateAll((els) => els.map((el) => Math.round((el as unknown as { getBoundingClientRect(): { top: number } }).getBoundingClientRect().top)));
    expect(tops.length).toBeGreaterThan(1);
    expect(new Set(tops).size).toBe(1);
    const chart = page.getByTestId("pl-chart");
    const c = (await chart.boundingBox())!;
    expect(c.width).toBeGreaterThanOrEqual(PHONE.width - 2);
    const plot = (await chart.locator("svg").first().boundingBox())!;
    const legend = (await chart.getByText("Expenses", { exact: true }).boundingBox())!;
    expect(legend.y).toBeGreaterThan(plot.y + plot.height - 2);
  });

  test("a statement is an indented list; tapping an account opens its drill-down; with a comparison each amount has the other period's under it", async ({ page, seededOrg: _ }) => {
    await open(page, "/reports/profit-and-loss");
    const list = page.locator("[data-statement-list]").first();
    await expect(list).toBeVisible();
    await expect(page.locator("table").filter({ has: page.getByRole("columnheader", { name: "Account" }) })).toHaveCount(0);
    await expect(list.getByText("Total income")).toBeVisible();
    // The whole row opens the account's drill-down.
    const row = list.locator("li").filter({ has: page.locator("button") }).first();
    const r = (await row.boundingBox())!;
    await page.mouse.click(r.x + r.width - 30, r.y + r.height / 2);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    // Compare with the previous period: the other period's amount, muted, under each.
    await page.getByTestId("report-filter-summary").click();
    const sheet = page.getByRole("dialog", { name: "Report filters" });
    await sheet.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Previous period" }).click();
    await sheet.getByRole("button", { name: "Show report" }).click();
    await expect(page.getByTestId("report-filter-summary")).toContainText("Previous period");
    await expect(page.locator("[data-statement-list]").first().locator("li .text-on-surface-muted").first()).toBeVisible();
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("a list report uses phone rows; a grid keeps its first column while the rest scroll inside their box", async ({ page, seededOrg: _ }) => {
    await open(page, "/reports/sales-by-customer");
    await expect(page.getByTestId("phone-list").locator("li[data-list-row]").first()).toBeVisible();

    await open(page, "/reports/trial-balance");
    await expect(page.getByTestId("report-filter-summary")).toContainText(/^.*As of \w{3} \d{1,2}, \d{4}/);
    const firstHeader = page.getByRole("columnheader", { name: /^Account/ });
    await expect(firstHeader).toHaveCSS("position", "sticky");
    const before = (await firstHeader.boundingBox())!;
    await firstHeader.evaluate((el) => {
      let box = el.parentElement as unknown as { scrollLeft: number; scrollWidth: number; clientWidth: number; parentElement: unknown } | null;
      while (box && box.scrollWidth <= box.clientWidth) box = box.parentElement as typeof box;
      if (box) box.scrollLeft = 200;
    });
    const after = (await firstHeader.boundingBox())!;
    expect(Math.round(after.x)).toBe(Math.round(before.x));
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("the Reports page lists its reports as rows, grouped as on the desktop", async ({ page, seededOrg: _ }) => {
    await open(page, "/reports");
    await expect(page.getByRole("heading", { name: "Business overview" })).toBeVisible();
    const pl = page.getByRole("link", { name: "Profit & Loss" }).first();
    const b = (await pl.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThan(PHONE.width - 120);
    await pl.click();
    await expect(page).toHaveURL(/\/reports\/profit-and-loss/);
  });
});
