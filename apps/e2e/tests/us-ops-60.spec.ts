import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PHONE } from "./phone-helpers";

/** A phone: 390×844 with a touch screen. */
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

/** Waits for the sheets' slide-in (and any other animation) to finish, so boxes are where they land. */
async function settled(page: Page) {
  await page.evaluate(async () => {
    const doc = (globalThis as unknown as { document: { getAnimations(): { finished: Promise<unknown> }[] } }).document;
    await Promise.all(doc.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b!;
}

/** Docked to the bottom edge, the screen's width. */
async function expectBottomSheet(locator: Locator) {
  const b = await box(locator);
  expect(Math.round(b.x)).toBe(0);
  expect(Math.round(b.width)).toBe(PHONE.width);
  expect(Math.round(b.y + b.height)).toBeGreaterThanOrEqual(PHONE.height - 1);
}

async function openRowMenu(page: Page, draft = false) {
  await page.goto("/invoices");
  await page.waitForLoadState("networkidle");
  // A draft's menu has Delete; other tests may have issued the first row, so pick a draft when that matters.
  const rows = draft ? page.locator("li[data-list-row]").filter({ has: page.locator("[data-list-row-title]", { hasText: /^Draft$/ }) }) : page;
  await rows.getByRole("button", { name: /^Actions for/ }).first().click();
  await expect(page.getByRole("menu")).toBeVisible();
  await settled(page);
  return page.getByRole("menu");
}

test.describe("US-OPS-60 · use dialogs, menus and pickers made for my phone", () => {
  test("a dialog with a form fills the screen, Cancel on the left and its action on the right of its header", async ({ page, seededOrg: _ }) => {
    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    await expect(dialog).toBeVisible();
    await settled(page);
    const d = await box(dialog);
    expect([Math.round(d.x), Math.round(d.y), Math.round(d.width), Math.round(d.height)]).toEqual([0, 0, PHONE.width, PHONE.height]);
    const cancel = await box(dialog.getByRole("button", { name: "Cancel" }));
    const action = await box(dialog.getByRole("button", { name: "Record payment" }));
    expect(cancel.y).toBeLessThan(80);
    expect(action.y).toBeLessThan(80);
    expect(cancel.x).toBeLessThan(PHONE.width / 2);
    expect(action.x + action.width).toBeGreaterThan(PHONE.width / 2);
    // Its ✕ steps aside for Cancel; Escape still closes it.
    await expect(dialog.getByRole("button", { name: "Close" })).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("a menu rises from the bottom as an action sheet with each action's icon and a Cancel; a destructive action is in the danger colour", async ({ page, seededOrg: _ }) => {
    const menu = await openRowMenu(page);
    const m = await box(menu);
    expect(Math.round(m.x)).toBe(8);
    expect(Math.round(m.width)).toBe(PHONE.width - 16);
    expect(m.y + m.height).toBeGreaterThan(PHONE.height - 40);
    const items = menu.getByRole("menuitem");
    expect(await items.count()).toBeGreaterThan(2);
    // Each action but Cancel has its icon; each row is at least 44px tall.
    for (const item of await items.all()) expect((await box(item)).height).toBeGreaterThanOrEqual(44);
    expect(await menu.locator('[role="menuitem"] svg').count()).toBeGreaterThan(1);
    const destructive = menu.getByRole("menuitem", { name: /Delete|Void/ }).first();
    if ((await destructive.count()) > 0) await expect(destructive).toHaveClass(/text-overdue/);
    await menu.getByRole("menuitem", { name: "Cancel" }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("a select's options, a combobox (with its search) and a date picker open in a bottom sheet", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    // The list's filters are in its Filters sheet on a phone (US-OPS-57).
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("dialog", { name: "Filters" }).getByRole("combobox").first().click();
    await expectBottomSheet(page.getByRole("listbox"));
    await page.keyboard.press("Escape");

    await page.goto("/quotes/new");
    await page.waitForLoadState("networkidle");
    await page.getByRole("combobox", { name: /Contact/ }).first().click();
    const sheet = page.locator("[data-phone-sheet]").filter({ has: page.getByRole("listbox") });
    await expectBottomSheet(sheet);
    // Once the sheet has finished rising and its options have loaded, its search is above them.
    await settled(page);
    await expect(sheet.getByRole("option").first()).toBeVisible();
    await expect
      .poll(async () => (await box(sheet.getByRole("combobox"))).y < (await box(sheet.getByRole("option").first())).y)
      .toBe(true);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /\d{1,2}\/\d{1,2}\/\d{4}/ }).first().click();
    await expectBottomSheet(page.locator("[data-phone-sheet]").filter({ has: page.getByRole("grid") }));
  });

  test("a confirmation stays a small alert in the middle, its buttons full width", async ({ page, seededOrg: _ }) => {
    const menu = await openRowMenu(page, true);
    await menu.getByRole("menuitem", { name: /^Delete/ }).click();
    const alert = page.getByRole("alertdialog");
    await expect(alert).toBeVisible();
    const a = await box(alert);
    expect(Math.round(a.x)).toBe(16);
    expect(a.y).toBeGreaterThan(80);
    expect(a.y + a.height).toBeLessThan(PHONE.height - 80);
    for (const button of await alert.getByRole("button").all()) expect((await box(button)).width).toBeGreaterThan(a.width - 60);
    await page.keyboard.press("Escape");
  });

  test("a drawer is a bottom sheet that drags up to full height and swipes down to close", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    await page.getByTestId("app-top-bar").getByRole("button", { name: /^Notifications/ }).click();
    const drawer = page.getByRole("dialog", { name: "Notifications" });
    await expect(drawer).toBeVisible();
    await settled(page);
    await expectBottomSheet(drawer);
    const before = await box(drawer);
    const grab = await box(drawer.getByTestId("drawer-grabber"));
    const drag = async (dy: number) => {
      await page.mouse.move(grab.x + grab.width / 2, grab.y + 5);
      await page.mouse.down();
      await page.mouse.move(grab.x + grab.width / 2, grab.y + 5 + dy, { steps: 8 });
      await page.mouse.up();
      await settled(page);
    };
    await drag(-200);
    await expect.poll(async () => (await box(drawer)).height).toBeGreaterThan(before.height + 100);
    const tall = await box(drawer);
    const grabTall = await box(drawer.getByTestId("drawer-grabber"));
    Object.assign(grab, grabTall);
    await drag(200);
    await expect.poll(async () => (await box(drawer)).height).toBeLessThan(tall.height);
    Object.assign(grab, await box(drawer.getByTestId("drawer-grabber")));
    await drag(200);
    await expect(drawer).toHaveCount(0);
  });

  test("search fills the screen with Cancel and shows no keyboard shortcuts", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    await page.getByTestId("app-top-bar").getByRole("button", { name: "Search" }).click();
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible();
    await settled(page);
    const p = await box(palette);
    expect([Math.round(p.x), Math.round(p.y), Math.round(p.width), Math.round(p.height)]).toEqual([0, 0, PHONE.width, PHONE.height]);
    await expect(palette.getByText("Cancel")).toBeVisible();
    // The keyboard hints are still in the page for a keyboard, but none is shown on a touch screen.
    for (const hint of await palette.getByText(/⌘K|Ctrl K|Enter to open|Esc to close|^Esc$/).all()) await expect(hint).toBeHidden();
    // The Owner's review: room around the field — 16px above it, a filled 44px field with Cancel
    // beside it, the scopes as pills under it, and rows a thumb can hit.
    const field = await box(palette.getByTestId("command-palette-field"));
    expect(field.y).toBeGreaterThanOrEqual(16);
    expect(field.height).toBeGreaterThanOrEqual(44);
    const cancel = await box(palette.getByText("Cancel"));
    expect(Math.abs(cancel.y + cancel.height / 2 - (field.y + field.height / 2))).toBeLessThan(4);
    const pills = palette.getByRole("radio");
    if (await pills.count()) {
      const first = await box(pills.first());
      expect(first.y).toBeGreaterThanOrEqual(field.y + field.height + 8);
      await expect(pills.first()).toHaveCSS("border-radius", /9999px|\d{2,}px/);
    }
    await palette.getByText("Cancel").click();
    await expect(palette).toHaveCount(0);
  });

  test("a sheet keeps focus inside, is named by its title, closes with Escape, and appears without sliding with reduced motion", async ({ page, seededOrg: _ }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((el) => el.contains((el.ownerDocument as unknown as { activeElement: unknown }).activeElement as never))).toBe(true);
    expect(await dialog.evaluate((el) => (globalThis as unknown as { getComputedStyle(e: unknown): { animationName: string } }).getComputedStyle(el).animationName)).toBe("none");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    const menu = await openRowMenu(page);
    expect(await menu.evaluate((el) => (globalThis as unknown as { getComputedStyle(e: unknown): { animationName: string } }).getComputedStyle(el).animationName)).toBe("none");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
  });
});

test.describe("US-OPS-60 · from 768px up", () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test("dialogs stay centred and menus drop down beside their button", async ({ page, seededOrg: _ }) => {
    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    const d = await box(page.getByRole("dialog", { name: "Record a payment" }));
    expect(d.x).toBeGreaterThan(100);
    await page.keyboard.press("Escape");
    const menu = await openRowMenu(page);
    expect((await box(menu)).width).toBeLessThan(400);
    await expect(menu.getByRole("menuitem", { name: "Cancel" })).toHaveCount(0);
  });
});
