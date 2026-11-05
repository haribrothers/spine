import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-SITE-11, US-SITE-12 · help for this page, from the guide on this server", () => {
  test("the Help menu opens this page's guide from this server, which works with no outside requests", async ({ page, context }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-site-11-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.goto("/invoices");
    await page.getByRole("button", { name: "Help", exact: true }).click();
    const menu = page.getByTestId("help-menu");
    for (const item of ["Help for this page", "User guide", "Keyboard shortcuts", "Online docs"]) await expect(menu).toContainText(item);
    await expect(menu).toContainText("Invoices — opens the guide on this server");
    await expect(page.getByTestId("help-menu-footer")).toContainText("the guide on this server matches your version");

    // Nothing the guide loads may come from outside this server.
    const outside: string[] = [];
    context.on("request", (request) => {
      const url = new URL(request.url());
      if (!["localhost", "127.0.0.1"].includes(url.hostname)) outside.push(request.url());
    });
    const [guide] = await Promise.all([context.waitForEvent("page"), page.getByRole("menuitem", { name: /Help for this page/ }).click()]);
    await guide.waitForLoadState("networkidle");
    expect(new URL(guide.url()).pathname).toMatch(/^\/help\/guide\/invoices\/?$/);
    await expect(guide.getByRole("note")).toContainText("served by your own server — it works without internet.");
    await expect(guide.getByRole("link", { name: /See the latest online docs/ })).toHaveAttribute("href", "https://docs.h4loom.com/");
    await expect(guide.getByRole("heading", { level: 1 })).toBeVisible();

    // Search runs in the browser.
    await guide.getByRole("button", { name: /Search/ }).first().click();
    await guide.getByRole("searchbox").fill("payment");
    await expect(guide.locator("[data-pagefind-ui] .pagefind-ui__result, .pagefind-ui__result").first()).toBeVisible({ timeout: 15_000 });
    expect(outside).toEqual([]);

    // The bundled copy has no developer docs, and no version menu.
    const dev = await guide.request.get("/help/developers/architecture/");
    expect(dev.status()).toBe(404);
    await expect(guide.getByRole("combobox", { name: /version/i })).toHaveCount(0);
  });
});
