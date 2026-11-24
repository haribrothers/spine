import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";

test.describe("US-NTF-12", () => {
  test("a Field member finds Browser notifications on their own profile", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("about:blank");
    await page.context().clearCookies();
    await logIn(page, DEMO_FIELD_USER);
    // US-SET-30: Profile & Preferences is Settings › Your account; /profile opens it.
    await page.goto("/profile?tab=notifications");
    await expect(page).toHaveURL(/settings=notifications/);
    const section = page.getByTestId("browser-notifications");
    await expect(section.getByRole("heading", { name: "Browser notifications" })).toBeVisible();
    // One of the US-NTF-04 states for this device.
    await expect(section).toContainText(
      /Not enabled on this device|Enabled on this device|Blocked by the browser|aren't configured on this Spine instance|doesn't support push notifications/,
    );
  });

  test("organisation Settings no longer lists Browser notifications", async ({ page, seededOrg }) => {
    await page.goto("about:blank");
    await page.context().clearCookies();
    await logIn(page, { email: seededOrg.ownerEmail, password: seededOrg.ownerPassword });
    await page.getByRole("button", { name: /E2E Seeded Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Business profile" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Browser notifications" })).toHaveCount(0);
  });
});
