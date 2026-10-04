import { test, expect } from "@playwright/test";

/** The E2E instance keeps sign-up open for its own fixtures, so the closed state is faked here. */
async function closeSignup(page: import("@playwright/test").Page) {
  await page.route("**/public/signup-status", (route) => route.fulfill({ json: { open: false, businessName: "Riverstone Builders" } }));
}

test.describe("US-AUTH-08", () => {
  test("an existing install's sign-up page says it's invite-only, with no form", async ({ page }) => {
    await closeSignup(page);
    await page.goto("/signup");
    const closed = page.getByTestId("signup-closed");
    await expect(closed).toContainText("This Spine is invite-only");
    await expect(closed).toContainText(
      "Riverstone Builders already has an owner, so new accounts are created by invitation. Ask an owner to invite you — you'll get an email with a link to join.",
    );
    await expect(page.getByLabel("Password")).toHaveCount(0);
    await closed.getByRole("link", { name: "Log in" }).click();
    await page.waitForURL("**/login");
  });

  test("login hides 'Sign up' when sign-up is closed", async ({ page }) => {
    await closeSignup(page);
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toHaveCount(0);
  });

  test("an invitation link still shows the form, with the invited email", async ({ page }) => {
    await closeSignup(page);
    await page.goto("/signup?inviteId=abc&email=invited%40example.com");
    await expect(page.getByLabel("Email")).toHaveValue("invited@example.com");
    await expect(page.getByTestId("signup-closed")).toHaveCount(0);
  });

  test("a fresh install shows the first-account form", async ({ page }) => {
    await page.route("**/public/signup-status", (route) => route.fulfill({ json: { open: true, businessName: null } }));
    await page.goto("/signup");
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });
});
