import { randomUUID } from "node:crypto";
import { test, expect, type Page, type Route } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

async function indianOrg(page: Page) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-dash-27-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const res = await page.request.post(`${API_URL}/demo-data/seed`, { headers: { "Idempotency-Key": randomUUID() }, data: { country: "IN", industry: "construction" } });
  expect(res.ok()).toBe(true);
}

/** Holds matching requests until `release` is called. */
function gate() {
  let release!: () => void;
  const opened = new Promise<void>((resolve) => (release = resolve));
  return {
    release,
    handler: async (route: Route) => {
      await opened;
      await route.continue().catch(() => {});
    },
  };
}

test.describe("US-DASH-27", () => {
  test("the page's shape until the layout is known, then each card's outline until its data arrives, in the organisation's currency", async ({ page }) => {
    test.setTimeout(120_000);
    await indianOrg(page);
    await page.setViewportSize({ width: 1440, height: 1000 });

    const layout = gate();
    const data = gate();
    await page.route("**/users/me/dashboard-layout", layout.handler);
    await page.route("**/dashboard/kpis**", data.handler);
    await page.route("**/money-accounts", data.handler);
    await page.goto("/dashboard");

    // The whole page in grey, announced once.
    const body = page.getByTestId("dashboard-body");
    await expect(body).toHaveAttribute("aria-busy", "true");
    await expect(page.getByRole("status").filter({ hasText: "Loading dashboard" })).toBeAttached();
    await expect(body.getByTestId("kpi-skeleton")).toHaveCount(4);
    await expect(body.getByTestId("dashboard-side")).toBeVisible();

    // The layout is known: real cards with their titles, each showing its own outline.
    layout.release();
    await expect(body).toHaveAttribute("aria-busy", "false");
    await expect(page.getByRole("status").filter({ hasText: "Loading dashboard" })).toHaveCount(0);
    await expect(page.getByTestId("kpi-row-loading").getByTestId("kpi-skeleton")).toHaveCount(4);
    const accounts = page.getByTestId("accounts-card");
    await expect(accounts).toContainText("Accounts");
    await expect(accounts.getByTestId("widget-skeleton")).toBeVisible();

    // The figures arrive in rupees, never dollars first.
    data.release();
    await expect(page.getByTestId("kpi-row")).toBeVisible();
    await expect(accounts.getByTestId("widget-skeleton")).toHaveCount(0);
    await expect(accounts).toContainText("₹");
    await expect(accounts).not.toContainText("$");
    await expect(page.getByTestId("kpi-row")).not.toContainText("$");
  });

  test("a card the member can't see leaves no placeholder or gap, and Reduce Motion stops the shimmer", async ({ page }) => {
    test.setTimeout(120_000);
    await indianOrg(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });

    const layout = gate();
    await page.route("**/users/me/dashboard-layout", layout.handler);
    await page.route("**/dashboard/tax-period", (route) => route.fulfill({ status: 403, json: { message: "Forbidden" } }));
    await page.goto("/dashboard");

    const pulse = page.getByTestId("kpi-skeleton").first().locator(".animate-pulse").first();
    await expect(pulse).toBeVisible();
    expect(await pulse.evaluate((el) => (globalThis as unknown as { getComputedStyle(e: unknown): { backgroundColor: string; animationName: string } }).getComputedStyle(el).animationName)).toBe("none");

    layout.release();
    await expect(page.getByTestId("kpi-row")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("tax-period")).toHaveCount(0);
    await expect(page.locator('[data-widget="tax-period"]')).toBeHidden();
  });
});
