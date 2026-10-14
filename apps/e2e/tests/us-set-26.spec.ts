import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-SET-26", () => {
  test("signed out, the login page shows the Spine logo and the browser gets the app icons", async ({ page, request }) => {
    await page.goto("/login");
    await expect(page.getByRole("img", { name: "Spine" })).toBeVisible();

    // The icons and manifest are public: a signed-out tab and a home screen need them.
    const head = page.locator("head");
    await expect(head.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
    await expect(head.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(head.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(head.locator('meta[name="theme-color"]')).toHaveCount(2);
    for (const url of ["/favicon.ico", "/icon.svg", "/apple-icon.png", "/icons/icon-192.png", "/icons/notification-192.png", "/icons/badge-96.png"]) {
      expect((await request.get(url)).status(), url).toBe(200);
    }
    const manifest = (await (await request.get("/manifest.webmanifest")).json()) as { display: string; icons: { purpose: string }[] };
    expect(manifest.display).toBe("browser");
    expect(manifest.icons.map((icon) => icon.purpose)).toContain("maskable");
  });

  test("the sidebar shows the horizontal logo, and the mark alone when collapsed", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-set-26-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await page.goto("/dashboard");
    const logo = page.getByRole("complementary").getByRole("img", { name: "Spine" }).first();
    await expect(logo).toBeVisible();
    const expanded = await logo.boundingBox();
    expect(expanded!.width).toBeGreaterThan(expanded!.height * 2);

    // Collapsed, the mark alone is the expand button.
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByText("S", { exact: true })).toHaveCount(0);
    const expand = page.getByRole("button", { name: "Expand sidebar" });
    const mark = await expand.locator("svg").first().boundingBox();
    expect(Math.round(mark!.width)).toBe(Math.round(mark!.height));
    await expand.click();
    await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  });
});
