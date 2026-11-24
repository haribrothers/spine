import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PHONE, sidewaysScroll } from "./phone-helpers";

/** A phone: 390×844 with a touch screen. */
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

/** Opens the first row of `list` whose row shows `badge` (Overdue, Draft, Active). */
async function openRow(page: Page, list: string, badge?: RegExp) {
  await page.goto(list);
  await page.waitForLoadState("networkidle");
  const rows = page.getByTestId("phone-list").locator("li[data-list-row]");
  const row = badge ? rows.filter({ hasText: badge }).first() : rows.first();
  await row.locator("[data-list-row-title] a").click();
  await page.waitForURL(new RegExp(`${list}/[0-9a-f-]{36}`));
  await page.waitForLoadState("networkidle");
}

async function box(page: Page, selector: string) {
  return (await page.locator(selector).first().boundingBox())!;
}

test.describe("US-OPS-58 · read and act on a record on my phone", () => {
  test("the top shows the number, its status and the balance due, then the contact; the back arrow, not breadcrumbs", async ({ page, seededOrg: _ }) => {
    await openRow(page, "/invoices", /Overdue/);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
    await expect(page.getByTestId("invoice-state")).toHaveText("Overdue");
    const amount = page.locator("[data-record-amount]");
    await expect(amount).toBeVisible();
    await expect(amount).toContainText("Balance due");
    await expect(amount).toContainText(/\$[\d,]+\.\d\d/);
    await expect(amount).toContainText(/overdue/i);
    const contact = (await page.getByTestId("invoice-meta").getByRole("link").first().boundingBox())!;
    const a = (await amount.boundingBox())!;
    const title = (await h1.boundingBox())!;
    expect(title.y).toBeLessThan(a.y);
    expect(a.y + a.height).toBeLessThanOrEqual(contact.y);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeHidden();
    await expect(page.getByTestId("app-top-bar").getByRole("button", { name: "Back" })).toBeVisible();
  });

  test("the main action is a full-width bar above the tabs; the rest are under ⋯ as an action sheet; nothing runs off the screen", async ({ page, seededOrg: _ }) => {
    await openRow(page, "/invoices", /Overdue/);
    const bar = page.locator("[data-action-bar]");
    const main = bar.getByRole("button");
    await expect(main).toHaveCount(1);
    await expect(main).toHaveText(/Send reminder|Record payment/);
    const b = (await main.boundingBox())!;
    const tabs = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
    expect(b.width).toBeGreaterThan(PHONE.width - 40);
    expect(b.y + b.height).toBeLessThanOrEqual(tabs.y);
    // The desktop's buttons row isn't shown.
    await expect(page.getByTestId("invoice-actions")).toBeHidden();

    await page.getByTestId("app-top-bar").getByRole("button", { name: "More actions" }).click();
    const sheet = page.getByRole("menu");
    await expect(sheet).toHaveAttribute("data-phone-sheet", "action");
    await expect(sheet.getByText(/ due$/)).toBeVisible();
    await expect(sheet.getByRole("menuitem", { name: /^(Download PDF|Email invoice)$/ }).first()).toBeVisible();
    await expect(sheet.getByRole("menuitem", { name: "Cancel" })).toBeVisible();
    await page.keyboard.press("Escape");
    // Focus goes back to the ⋯ that opened it.
    await expect(page.getByTestId("app-top-bar").getByRole("button", { name: "More actions" })).toBeFocused();
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("a document's lines are cards with the item, its description, quantity × rate, tax and amount; the totals under them", async ({ page, seededOrg: _ }) => {
    await openRow(page, "/quotes");
    const cards = page.locator("[data-line-card]");
    await expect(cards.first()).toBeVisible();
    await expect(cards.first()).toContainText(/\d+(\.\d+)? × \$[\d,]+\.\d\d/);
    await expect(page.getByTestId("quote-lines").getByRole("table")).toHaveCount(0);
    const lastCard = (await cards.last().boundingBox())!;
    const totals = (await page.getByTestId("quote-totals").boundingBox())!;
    expect(totals.y).toBeGreaterThan(lastCard.y);
    await expect(page.getByTestId("quote-totals")).toContainText("Subtotal");
    await expect(page.getByTestId("quote-totals")).toContainText("Total");
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("a job's figures are two per row; its tabs are one row that scrolls, the chosen one in view; its milestones are rows", async ({ page, seededOrg: _ }) => {
    await openRow(page, "/jobs", /Active/);
    await expect(page.getByTestId("fig-billed")).toBeVisible();
    const figs = await page.getByTestId("job-figures").locator(":scope > *").evaluateAll((els) =>
      els.map((el) => {
        const r = (el as unknown as { getBoundingClientRect(): { top: number; width: number } }).getBoundingClientRect();
        return { top: Math.round(r.top), width: Math.round(r.width) };
      }),
    );
    expect(figs.length).toBeGreaterThan(1);
    // The first two share a row.
    expect(figs[0]!.top).toBe(figs[1]!.top);

    // The main step is in the bar at the bottom; Edit job is under ⋯.
    await expect(page.locator("[data-action-bar]").getByRole("button")).toHaveCount(1);
    await page.getByTestId("app-top-bar").getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("menu").getByRole("menuitem", { name: "Edit job" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Milestones are rows, each with its ⋯.
    const row = page.getByTestId("milestone-row").first();
    await expect(row.getByRole("button", { name: /^Actions for / })).toBeVisible();

    // Opened on its last tab, that tab is scrolled into the row.
    await page.goto(`${page.url().split("?")[0]}?tab=crew`);
    await page.waitForLoadState("networkidle");
    const list = page.getByRole("tablist");
    const crew = page.getByRole("tab", { name: /^Crew/ });
    await expect(crew).toHaveAttribute("data-state", "active");
    await expect
      .poll(async () => {
        const l = (await list.boundingBox())!;
        const c = (await crew.boundingBox())!;
        return c.x >= l.x - 1 && c.x + c.width <= l.x + l.width + 1;
      })
      .toBe(true);
    expect(await sidewaysScroll(page)).toBe(0);
  });
});

test.describe("US-OPS-58 · from 768px up", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test("the record's buttons and figures are where they were", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: /INV-/ }).first().click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}/);
    await expect(page.getByTestId("invoice-actions")).toBeVisible();
    await expect(page.getByTestId("invoice-actions").getByRole("button", { name: /^More/ })).toBeVisible();
    await expect(page.locator("[data-action-bar]")).toHaveCount(0);
    await expect(page.locator("[data-record-amount]")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  });
});
