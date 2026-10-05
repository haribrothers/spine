import { test, expect } from "./fixtures";

test.describe("US-DASH-19", () => {
  test("the feed names who did what with bold amounts, and 'View all' opens the full feed", async ({ page, seededOrg: _ }) => {
    await page.goto("/dashboard");
    const feed = page.getByRole("main").locator("li[data-type]").first().locator("xpath=ancestor::ul[1]");
    await expect(feed.locator("li").first()).toBeVisible({ timeout: 15_000 });

    // Every row with an actor starts with their name in bold beside an avatar.
    const withActor = feed.locator("li").filter({ has: page.locator("strong") }).first();
    await expect(withActor.locator("strong").first()).toHaveText(/\S/);
    // Amounts are bold in the shared money format.
    const payment = page.locator('li[data-type="payment_received"]').first();
    if (await payment.count()) await expect(payment.locator("strong").filter({ hasText: /^\$[\d,]+\.\d{2}$/ })).toHaveCount(1);

    await page.locator(`a[href="/activity"]`, { hasText: "View all" }).click();
    await expect(page).toHaveURL(/\/activity$/);
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(page.getByTestId("activity-page").locator("li[data-type]").first()).toBeVisible();
  });
});
