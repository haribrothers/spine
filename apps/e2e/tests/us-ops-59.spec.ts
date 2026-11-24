import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PHONE, sidewaysScroll } from "./phone-helpers";

/** A phone: 390×844 with a touch screen. */
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

/** Opens the edit page of the first draft quote. */
async function editDraftQuote(page: Page) {
  await page.goto("/quotes");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("phone-list").locator("li[data-list-row]").filter({ hasText: "Draft" }).first().locator("[data-list-row-title] a").click();
  await page.waitForURL(/\/quotes\/[0-9a-f-]{36}/);
  await page.goto(`${page.url().split("?")[0]}/edit`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-line-card]").first()).toBeVisible();
}

test.describe("US-OPS-59 · build a quote or invoice on my phone", () => {
  test("a builder fills the screen without the tab bar, with Cancel at the top left and its fields in one column", async ({ page, seededOrg: _ }) => {
    for (const path of ["/quotes/new", "/invoices/new", "/vendor-bills/new", "/vendor-credits/new"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("navigation", { name: "Main" }), path).toHaveCount(0);
      const bar = page.getByTestId("app-top-bar");
      const cancel = (await bar.getByRole("button", { name: "Cancel" }).boundingBox())!;
      expect(cancel.x, path).toBeLessThan(40);
      await expect(bar.getByRole("button", { name: "Search" }), path).toHaveCount(0);
      expect(await sidewaysScroll(page), path).toBe(0);
    }
    // One column: the quote's title and contact are one above the other, the same width.
    await page.goto("/quotes/new");
    await page.waitForLoadState("networkidle");
    const title = (await page.getByLabel(/^Title/).boundingBox())!;
    const contact = (await page.getByRole("combobox", { name: /Contact/ }).first().boundingBox())!;
    expect(Math.round(title.x)).toBe(Math.round(contact.x));
    expect(contact.y).toBeGreaterThan(title.y + title.height);
  });

  test("lines are cards; Add item opens a sheet kept with Done; a line opens in the same sheet with Move up, Move down and Delete", async ({ page, seededOrg: _ }) => {
    await editDraftQuote(page);
    const cards = page.locator("[data-line-card]");
    const before = await cards.count();
    await expect(cards.first()).toContainText(/\d+(\.\d+)? × \$[\d,]+\.\d\d/);

    // Add item: every field in one sheet; Cancel keeps nothing.
    await page.getByRole("button", { name: "Add item" }).click();
    const sheet = page.getByTestId("line-sheet");
    await expect(sheet.getByRole("heading", { name: "New line" }).or(sheet.getByText("New line"))).toBeVisible();
    for (const label of ["Description", "Quantity", "Unit price", "Discount %"]) await expect(sheet.getByLabel(label), label).toBeVisible();
    await expect(sheet.getByRole("combobox", { name: "Tax" })).toBeVisible();
    await sheet.getByRole("button", { name: "Cancel" }).click();
    await expect(cards).toHaveCount(before);

    // Add item and Done: a new card.
    await page.getByRole("button", { name: "Add item" }).click();
    await sheet.getByRole("combobox").first().fill("Site visit");
    await page.keyboard.press("Escape");
    await sheet.getByLabel("Quantity").fill("2");
    await sheet.getByLabel("Unit price").fill("75");
    await expect(sheet.getByText("Line amount")).toBeVisible();
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(cards).toHaveCount(before + 1);
    await expect(cards.last()).toContainText("Site visit");
    await expect(cards.last()).toContainText("2 × $75.00");

    // A line opens in the same sheet, "Line n of m", with Move up, Move down and Delete.
    await cards.last().click();
    await expect(sheet.getByText(`Line ${before + 1} of ${before + 1}`)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Move down" })).toBeDisabled();
    await sheet.getByRole("button", { name: "Move up" }).click();
    await expect(sheet.getByText(`Line ${before} of ${before + 1}`)).toBeVisible();
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect(cards.nth(before - 1)).toContainText("Site visit");
    await cards.nth(before - 1).click();
    await sheet.getByRole("button", { name: "Delete" }).click();
    await expect(cards).toHaveCount(before);
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("a slim bar has the total (tap it for the subtotal and tax) and the main button, with Save as draft and Preview PDF under ⋯; it steps aside while I type", async ({ page, seededOrg: _ }) => {
    await editDraftQuote(page);
    const bar = page.getByTestId("quote-builder-bar");
    await expect(bar.getByTestId("quote-total-total")).toContainText(/\$[\d,]+\.\d\d/);
    await expect(bar.getByTestId("quote-total-subtotal")).toHaveCount(0);
    await bar.getByRole("button", { name: /^Total/ }).click();
    await expect(bar.getByTestId("quote-total-subtotal")).toBeVisible();
    await expect(bar.getByTestId("quote-total-tax")).toBeVisible();
    await expect(bar.getByRole("button", { name: "Save and send" })).toBeVisible();
    const b = (await bar.boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(PHONE.height + 1);
    expect(b.height).toBeLessThan(160);

    await bar.getByRole("button", { name: "More actions" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: /^Save draft$|^Save as draft$/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Preview PDF" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Typing in a field: the bar steps aside, clear of the keyboard and the field.
    await page.getByLabel(/^Title/).focus();
    await expect(bar).toBeHidden();
    await page.getByLabel(/^Title/).blur();
    await expect(bar).toBeVisible();
  });

  test("with unsaved changes, Cancel asks before anything is lost", async ({ page, seededOrg: _ }) => {
    await editDraftQuote(page);
    await page.getByLabel(/^Title/).fill("Changed on my phone");
    await page.getByLabel(/^Title/).blur();
    await page.getByTestId("app-top-bar").getByRole("button", { name: "Cancel" }).click();
    const ask = page.getByRole("alertdialog");
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: "Keep editing" }).click();
    await expect(page.getByLabel(/^Title/)).toHaveValue("Changed on my phone");
  });
});

test.describe("US-OPS-59 · from 768px up", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test("the builder's lines, bar and buttons are as they were", async ({ page, seededOrg: _ }) => {
    await page.goto("/quotes/new");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-line-card]")).toHaveCount(0);
    const bar = page.getByTestId("quote-builder-bar");
    await expect(bar.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Preview PDF" })).toBeVisible();
    await expect(bar.getByTestId("quote-total-subtotal")).toBeVisible();
  });
});
