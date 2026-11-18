import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";
import { axeViolations } from "./axe";
import { PHONE, smallControls } from "./phone-helpers";

/** A phone: 390×844 with a touch screen. */
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

const tabBar = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Main" });

test.describe("US-OPS-54 · get around the web app from tabs along the bottom of my phone", () => {
  test("tabs along the bottom: Home, Sales, Jobs, Money and More; the current one marked; no slide-over menu", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    const bar = tabBar(page);
    await expect(bar).toBeVisible();
    for (const name of ["Home", "Sales", "Jobs", "Money"]) await expect(bar.getByRole("link", { name })).toBeVisible();
    await expect(bar.getByRole("button", { name: "More" })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("button", { name: "Open navigation" })).toHaveCount(0);
    await expect(page.locator("aside")).toHaveCount(0);

    // At the bottom of the screen, every tab at least 44×44px.
    const box = (await bar.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(PHONE.height);
    expect(await smallControls(page, 'nav[aria-label="Main"]')).toEqual([]);
  });

  test("Sales, Jobs and Money open the page last used there, with the area's pages in a row at the top", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    await tabBar(page).getByRole("link", { name: "Sales" }).click();
    await expect(page).toHaveURL(/\/quotes$/);
    const row = page.getByRole("navigation", { name: "Sales" });
    for (const name of ["Quotes", "Contacts", "Pipeline", "Meetings", "Catalogue"]) await expect(row.getByRole("link", { name })).toBeVisible();
    await expect(row.getByRole("link", { name: "Quotes" })).toHaveAttribute("aria-current", "page");
    await expect(tabBar(page).getByRole("link", { name: "Sales" })).toHaveAttribute("aria-current", "page");

    await tabBar(page).getByRole("link", { name: "Money" }).click();
    await expect(page).toHaveURL(/\/invoices$/);
    const money = page.getByRole("navigation", { name: "Money" });
    for (const name of ["Invoices", "Payments", "Receivables", "Credit Notes", "Vendor Bills", "Expenses", "Payables", "Banking", "Reports"]) await expect(money.getByRole("link", { name })).toHaveCount(1);
    await money.getByRole("link", { name: "Payments" }).click();
    await expect(page).toHaveURL(/\/payments$/);

    await tabBar(page).getByRole("link", { name: "Jobs" }).click();
    await expect(page).toHaveURL(/\/jobs$/);
    // Money opens where I left it.
    await tabBar(page).getByRole("link", { name: "Money" }).click();
    await expect(page).toHaveURL(/\/payments$/);
  });

  test("More opens the whole menu in a sheet, with my account, Settings, Help and Sign out; it closes", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await tabBar(page).getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog", { name: "Menu" });
    await expect(sheet).toBeVisible();
    for (const group of ["Overview", "Sales", "Jobs", "Billing", "Purchases", "Money", "Reports", "Team"]) await expect(sheet.getByRole("region", { name: group })).toHaveCount(1);
    await expect(sheet.getByRole("link", { name: "Invoices" })).toHaveAttribute("aria-current", "page");
    await expect(sheet.getByRole("button", { name: /^Your account: / })).toBeVisible();
    for (const name of ["Settings", "Help", "Sign out"]) await expect(sheet.getByRole("button", { name })).toBeVisible();
    // The tab bar steps aside while the full-height sheet is open.
    await expect(tabBar(page)).toBeHidden();

    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(tabBar(page)).toBeVisible();

    // Choosing a page goes there and closes the sheet.
    await tabBar(page).getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL(/\/team\/users$/);
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
    await expect(tabBar(page).getByRole("button", { name: "More" })).toBeVisible();

    // A swipe down on its header closes it.
    await tabBar(page).getByRole("button", { name: "More" }).click();
    const header = page.getByRole("dialog", { name: "Menu" }).getByRole("heading", { name: "Menu" });
    const h = (await header.boundingBox())!;
    await page.mouse.move(h.x + 20, h.y + 5);
    await page.mouse.down();
    await page.mouse.move(h.x + 20, h.y + 200, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
  });

  test("the top bar has the page's title, search and notifications; a record has a back arrow that returns to the list as I left it; no breadcrumb", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    const top = page.getByTestId("app-top-bar");
    await expect(top.getByTestId("app-top-bar-title")).toHaveText("Invoices");
    await expect(top.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(top.getByRole("button", { name: /^Notifications/ })).toBeVisible();
    await expect(top.getByRole("button", { name: "Back" })).toHaveCount(0);

    const main = page.getByRole("main");
    await page.waitForLoadState("networkidle");
    await main.evaluate((el) => {
      (el as unknown as { scrollTop: number }).scrollTop = 300;
    });
    // Where the list is when I open a record (opening it scrolls the row into view first).
    const row = page.getByText("DEMO-INV-0001", { exact: true }).first();
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    const before = await main.evaluate((el) => (el as unknown as { scrollTop: number }).scrollTop);
    expect(before).toBeGreaterThan(0);
    await row.click();
    await expect(top.getByTestId("app-top-bar-title")).toHaveText("Invoice");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeHidden();

    await top.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/invoices$/);
    await expect.poll(() => main.evaluate((el) => (el as unknown as { scrollTop: number }).scrollTop)).toBe(before);
  });

  test("a record opened from a link, not from Spine, goes back to its list", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    const href = await page.locator('a[href^="/invoices/"]').first().getAttribute("href");
    await page.goto(href!);
    await page.getByTestId("app-top-bar").getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/invoices$/);
  });

  test("a builder fills the screen without the tab bar; typing in a field hides it too", async ({ page, seededOrg: _ }) => {
    await page.goto("/quotes/new");
    await expect(page.getByTestId("app-top-bar-title")).toHaveText("New quote");
    await expect(tabBar(page)).toHaveCount(0);

    await page.goto("/contacts");
    await expect(tabBar(page)).toBeVisible();
    await page.getByRole("main").locator("input[type=search], input[type=text]").first().focus();
    await expect(tabBar(page)).toBeHidden();
  });

  test("the tab bar and the More sheet pass axe in light and dark", async ({ page, seededOrg: _ }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
      expect(await axeViolations(page)).toEqual([]);
      await tabBar(page).getByRole("button", { name: "More" }).click();
      await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    }
  });

  test("a Field member has no Money tab; their expenses are under More", async ({ browser, seededOrg: _ }) => {
    const context = await browser.newContext({ viewport: PHONE, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await logIn(page, DEMO_FIELD_USER);
    await page.goto("/dashboard");
    const bar = tabBar(page);
    await expect(bar.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Jobs" })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Money" })).toHaveCount(0);
    await bar.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Expenses" })).toBeVisible();
    await context.close();
  });
});

test.describe("US-OPS-54 · from 768px up", () => {
  test.use({ viewport: { width: 1024, height: 800 }, hasTouch: false, isMobile: false });

  test("the sidebar and page header are as they were; no tab bar", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await expect(page.locator("aside")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    await expect(page.getByTestId("app-top-bar")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Invoices" })).toBeVisible();
  });
});
