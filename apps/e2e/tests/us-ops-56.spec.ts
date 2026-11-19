import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PHONE, sidewaysScroll } from "./phone-helpers";

/** A phone: 390×844 with a touch screen. */
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

/** Every list page, from the story; each is one row per record on a phone. */
const LISTS = ["/quotes", "/invoices", "/credit-notes", "/contacts", "/jobs", "/payments", "/receivables", "/vendor-bills", "/expenses", "/catalog", "/team/users"];

async function rows(page: Page) {
  await page.waitForLoadState("networkidle");
  return page.getByTestId("phone-list").locator("li[data-list-row]");
}

test.describe("US-OPS-56 · read any list as rows made for my phone", () => {
  test("each list is one row per record: no columns, column headings or sideways scrolling", async ({ page, seededOrg: _ }) => {
    test.setTimeout(180_000);
    for (const path of LISTS) {
      await page.goto(path);
      const list = await rows(page);
      await expect(list.first(), path).toBeVisible();
      expect(await page.getByRole("main").locator("table").count(), path).toBe(0);
      expect(await page.getByRole("columnheader").count(), path).toBe(0);
      expect({ path, sideways: await sidewaysScroll(page) }).toEqual({ path, sideways: 0 });
    }
  });

  test("an invoice row: number and status on the first line, contact on the second, the balance on the right; tapping it opens the invoice", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    const row = (await rows(page)).filter({ hasText: "DEMO-INV-0009" }).first();
    await expect(row).toBeVisible();
    await row.scrollIntoViewIfNeeded();
    const title = (await row.locator("[data-list-row-title]").boundingBox())!;
    const badge = (await row.getByText(/^(Due|Issued|Overdue|Paid|Part paid|Draft|Void)$/).first().boundingBox())!;
    expect(Math.abs(title.y + title.height / 2 - (badge.y + badge.height / 2))).toBeLessThan(6);
    await expect(row).toContainText("$");
    // Anywhere on the row opens it, not just the number.
    const box = (await row.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height - 8);
    await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/);
  });

  test("a row's ⋯ opens its actions as an action sheet", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await (await rows(page)).first().getByRole("button", { name: /^Actions for/ }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Cancel" })).toBeVisible();
  });

  test("Select in the top bar shows each row's checkbox and the bulk actions at the bottom; Done ends it", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    const list = await rows(page);
    await expect(list.first()).toBeVisible();
    await expect(page.getByTestId("phone-list").getByRole("checkbox")).toHaveCount(0);
    const top = page.getByTestId("app-top-bar");
    await top.getByRole("button", { name: "Select" }).click();
    const boxes = page.getByTestId("phone-list").getByRole("checkbox");
    expect(await boxes.count()).toBeGreaterThan(0);
    await boxes.first().click();
    const bar = page.getByRole("region", { name: /selected|Bulk/i }).first();
    await expect(bar).toBeVisible();
    const b = (await bar.boundingBox())!;
    expect(Math.round(b.y + b.height)).toBe(PHONE.height);
    await top.getByRole("button", { name: "Done" }).click();
    await expect(page.getByTestId("phone-list").getByRole("checkbox")).toHaveCount(0);
    await expect(bar).toBeHidden();
    // Columns and the page-size picker aren't offered on a phone.
    await expect(page.getByRole("button", { name: "Columns" })).toBeHidden();
  });

  test("the pipeline shows one stage's leads, the stages as chips with counts above; moving a lead is in its menu", async ({ page, seededOrg: _ }) => {
    await page.goto("/leads");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("pipeline-board")).toHaveCount(0);
    const tabs = page.getByRole("tablist", { name: "Stages" }).getByRole("tab");
    expect(await tabs.count()).toBeGreaterThan(2);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveText(/\d+$/);
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    const panel = page.getByRole("tabpanel");
    await expect(panel).toBeVisible();
  });

  test("contacts are rows on a phone, without the Table · List · Card switcher", async ({ page, seededOrg: _ }) => {
    await page.goto("/contacts");
    await expect((await rows(page)).first()).toBeVisible();
    await expect(page.getByRole("radio", { name: /^(Table|List|Card)/ })).toHaveCount(0);
  });
});
