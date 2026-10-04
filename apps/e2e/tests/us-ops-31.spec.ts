import type { Page } from "@playwright/test";
import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";

const MESSAGE = "Storage is 91% full. Free up space or add disk before uploads stop working.";

/** The disk can't be filled in a test, so `/health/ready` reports a nearly full volume instead. */
async function reportStorage(page: Page, usedPercent: number) {
  await page.route("**/health/ready", (route) =>
    route.fulfill({ json: { status: "ok", storage: { driver: "local", usedPercent } } }),
  );
}

test.describe("US-OPS-31", () => {
  test("an Owner sees the storage banner on every page once the volume is over 85% full", async ({ page, seededOrg }) => {
    void seededOrg;
    await reportStorage(page, 91);
    await page.goto("/dashboard");
    await expect(page.getByTestId("storage-banner")).toHaveText(MESSAGE);
    await page.goto("/invoices");
    await expect(page.getByTestId("storage-banner")).toHaveText(MESSAGE);
  });

  test("no banner at 85% or below", async ({ page, seededOrg }) => {
    void seededOrg;
    await reportStorage(page, 85);
    await page.goto("/dashboard");
    await expect(page.getByText("Cash position")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("storage-banner")).toHaveCount(0);
  });

  test("Field users never see the banner", async ({ seededOrg, browser }) => {
    void seededOrg;
    const context = await browser.newContext();
    const fieldPage = await context.newPage();
    await reportStorage(fieldPage, 99);
    await logIn(fieldPage, DEMO_FIELD_USER);
    await fieldPage.goto("/dashboard");
    await expect(fieldPage.getByText("Recent activity")).toBeVisible({ timeout: 15_000 });
    await expect(fieldPage.getByTestId("storage-banner")).toHaveCount(0);
    await context.close();
  });
});
