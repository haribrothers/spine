import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PHONE } from "./phone-helpers";

/** A phone: 390×844 with a touch screen. */
test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

/** Makes the page believe it was opened from the home screen (`display-mode: standalone`). */
async function asHomeScreenApp(page: Page) {
  await page.addInitScript(() => {
    const w = globalThis as unknown as { matchMedia: (q: string) => { matches: boolean } };
    const real = w.matchMedia.bind(w);
    w.matchMedia = (query: string) => (query.includes("display-mode: standalone") ? { ...real(query), matches: true, media: query } : real(query));
  });
}

test.describe("US-OPS-55 · open Spine from my phone's home screen like an app", () => {
  test("the manifest says standalone, starts at the dashboard, and has the name, icons and the token colours; the page fits under the notch", async ({ page, seededOrg: _ }) => {
    const res = await page.request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const manifest = (await res.json()) as { display: string; start_url: string; name: string; short_name: string; theme_color: string; background_color: string; icons: { src: string; purpose?: string }[] };
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.name).toBe("Spine");
    expect(manifest.short_name).toBe("Spine");
    expect(manifest.theme_color).toBe("#F7F6F3");
    expect(manifest.background_color).toBe("#F7F6F3");
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);

    await page.goto("/dashboard");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
    await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')).toHaveAttribute("content", "#121110");
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
    // The top bar and the tab bar keep clear of the notch and the home indicator.
    await expect(page.getByTestId("app-top-bar")).toHaveClass(/safe-area-inset-top/);
    await expect(page.getByRole("navigation", { name: "Main" })).toHaveClass(/safe-area-inset-bottom/);
  });

  test("from the home screen, a link to another site opens in the browser, not inside Spine", async ({ page, seededOrg: _ }) => {
    await asHomeScreenApp(page);
    await page.context().route("https://example.com/**", (route) => route.fulfill({ body: "elsewhere", contentType: "text/html" }));
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await page.getByRole("main").evaluate((main) => {
      const doc = (globalThis as unknown as { document: { createElement(t: string): { href: string; textContent: string } } }).document;
      const a = doc.createElement("a");
      a.href = "https://example.com/site";
      a.textContent = "A contact's website";
      (main as unknown as { prepend(n: unknown): void }).prepend(a);
    });
    const popup = page.waitForEvent("popup");
    await page.getByRole("link", { name: "A contact's website" }).click();
    const opened = await popup;
    expect(opened.url()).toContain("example.com/site");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("from the home screen, the back arrow takes me back", async ({ page, seededOrg: _ }) => {
    await asHomeScreenApp(page);
    await page.goto("/invoices");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("phone-list").locator("li[data-list-row] [data-list-row-title] a").first().click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}/);
    await page.getByTestId("app-top-bar").getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/invoices$/);
  });
});
