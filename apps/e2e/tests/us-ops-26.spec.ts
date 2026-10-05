import type { Page, TestInfo } from "@playwright/test";
import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";
import { expectNoAxeViolations } from "./axe";

type Theme = "light" | "dark";

/** Page and surface colours from the tokens (US-OPS-26, D-100). */
const COLOURS: Record<Theme, { background: string; surface: string }> = {
  light: { background: "rgb(247, 246, 243)", surface: "rgb(255, 255, 255)" },
  dark: { background: "rgb(18, 17, 16)", surface: "rgb(25, 24, 21)" },
};

const style = (selector: string, prop: string) => `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? getComputedStyle(el)[${JSON.stringify(prop)}] : null; })()`;

async function useTheme(page: Page, theme: Theme) {
  await page.addInitScript({ content: `localStorage.setItem("theme", "${theme}");` });
}

async function shoot(page: Page, testInfo: TestInfo, name: string, theme: Theme) {
  await page.waitForTimeout(400); // let charts settle
  await testInfo.attach(`${name}-${theme}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}

async function checkTheme(page: Page, theme: Theme) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  expect(await page.evaluate(style("body", "backgroundColor"))).toBe(COLOURS[theme].background);
}

/** Every Phase 7 screen, as it opens. */
const SCREENS: { name: string; open: (page: Page) => Promise<void> }[] = [
  {
    name: "dashboard",
    open: async (page) => {
      await page.goto("/dashboard");
      await expect(page.getByTestId("kpi-row")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("money-in-out").locator(".recharts-wrapper")).toBeVisible();
    },
  },
  {
    name: "search-palette",
    open: async (page) => {
      await page.goto("/dashboard");
      await expect(page.getByRole("main")).toBeVisible();
      await page.keyboard.press("ControlOrMeta+k");
      await page.getByRole("combobox", { name: "Search" }).fill("harbor");
      await expect(page.getByRole("option").first()).toBeVisible();
    },
  },
  {
    name: "invoices-bulk-select",
    open: async (page) => {
      await page.goto("/invoices");
      await page.getByRole("checkbox", { name: /select/i }).nth(1).check();
      await expect(page.getByRole("button", { name: /Send reminders/ })).toBeVisible();
    },
  },
  {
    name: "settings-reminders",
    open: async (page) => {
      await page.goto("/dashboard?settings=reminders");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("dialog").getByRole("heading").first()).toBeVisible();
    },
  },
  {
    name: "settings-data-export",
    open: async (page) => {
      await page.goto("/dashboard?settings=data-export");
      await expect(page.getByRole("dialog").getByTestId("data-export")).toBeVisible();
    },
  },
  {
    name: "audit-log",
    open: async (page) => {
      await page.goto("/team/audit-log");
      await expect(page.getByTestId("audit-table").locator("tbody tr").first()).toBeVisible();
    },
  },
  {
    name: "activity",
    open: async (page) => {
      await page.goto("/activity");
      await expect(page.getByTestId("activity-page").locator("li").first()).toBeVisible();
    },
  },
  {
    name: "profile-notifications",
    open: async (page) => {
      await page.goto("/profile?tab=notifications");
      await expect(page.getByTestId("daily-digest")).toBeVisible();
    },
  },
  {
    name: "recurring-invoices",
    open: async (page) => {
      await page.goto("/invoices/recurring");
      await expect(page.getByRole("heading", { name: /Recurring invoices/ })).toBeVisible();
    },
  },
  {
    name: "job-costing",
    open: async (page) => {
      await page.goto("/jobs");
      await page.getByRole("link", { name: /Hotel lobby renovation/ }).first().click();
      await page.getByRole("tab", { name: /Costing/ }).click();
      await expect(page.getByRole("tabpanel")).toBeVisible();
    },
  },
  {
    name: "job-profitability-report",
    open: async (page) => {
      await page.goto("/reports?tab=jobs");
      await expect(page.getByText("Contract, billed and cost by job")).toBeVisible();
    },
  },
];

test.describe("US-OPS-26", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const screen of SCREENS) {
      test(`${screen.name} in ${theme} mode: token colours, a screenshot, and axe passes`, async ({ page, seededOrg: _ }, testInfo) => {
        await useTheme(page, theme);
        await screen.open(page);
        await checkTheme(page, theme);
        await shoot(page, testInfo, screen.name, theme);
        await expectNoAxeViolations(page);
      });
    }

    test(`the Field dashboard in ${theme} mode`, async ({ page, seededOrg: _, browser }, testInfo) => {
      void page;
      const context = await browser.newContext();
      const fieldPage = await context.newPage();
      await useTheme(fieldPage, theme);
      await logIn(fieldPage, DEMO_FIELD_USER);
      await fieldPage.goto("/dashboard");
      await expect(fieldPage.getByTestId("my-jobs")).toBeVisible({ timeout: 15_000 });
      await checkTheme(fieldPage, theme);
      await shoot(fieldPage, testInfo, "dashboard-field", theme);
      await expectNoAxeViolations(fieldPage);
      await context.close();
    });
  }

  test("dark mode: the light wordmark, darkened overlays and surfaces that stand off the page", async ({ page, seededOrg: _ }) => {
    await useTheme(page, "dark");
    await page.goto("/dashboard");
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator('img[src*="spine-logo-horizontal-light"]').first()).toBeVisible();

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Search" });
    await expect(palette).toBeVisible();
    expect(await page.evaluate(style("[data-testid='command-palette']", "backgroundColor"))).toBe(COLOURS.dark.surface);
    expect(await page.evaluate(`(() => { const o = [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).position === "fixed" && getComputedStyle(d).inset === "0px" && d.nextElementSibling?.getAttribute("data-testid") === "command-palette"); return o ? getComputedStyle(o).backgroundColor : null; })()`)).toBe("rgba(0, 0, 0, 0.62)");
    await page.keyboard.press("Escape");

    // Money out bars use border-strong.
    await page.getByTestId("money-in-out").scrollIntoViewIfNeeded();
    await expect
      .poll(() => page.evaluate(`[...new Set([...document.querySelectorAll("[data-testid='money-in-out'] path.recharts-rectangle")].map((b) => b.getAttribute("fill")))]`))
      .toEqual(expect.arrayContaining(["var(--color-border-strong)"]));
  });
});
