import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test.describe("US-AUTH-15", () => {
  test("sign-up: see the password, measure it, confirm it; too short and common passwords are refused", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { level: 1, name: "Create your account" })).toBeVisible();
    await page.getByLabel(/^Name/).fill("Owner");
    await page.getByLabel(/^Email/).fill(`us-auth-15-${randomUUID()}@example.com`);
    const password = page.getByLabel(/^Password/);
    const confirm = page.getByLabel(/^Confirm password/);
    const strength = page.getByRole("status").filter({ hasText: "Password strength" });

    await password.fill("riverstone8");
    await expect(strength).toHaveText("Password strength: Fair");
    await expect(page.getByText("At least 8 characters (done)")).toBeAttached();
    await password.fill("Deck&Pergola-2026");
    await expect(strength).toHaveText("Password strength: Strong");

    // Both password fields can be shown.
    await expect(page.getByRole("button", { name: "Show password" })).toHaveCount(2);

    await confirm.fill("Deck&Pergola-2025");
    await confirm.blur();
    await expect(page.getByText("The passwords don't match.")).toBeVisible();

    await password.fill("short");
    await confirm.fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible();

    await password.fill("Password123");
    await confirm.fill("Password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("That password is too common. Choose another one.")).toBeVisible();

    await password.fill("Deck&Pergola-2026");
    await confirm.fill("Deck&Pergola-2026");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");
  });

  test("Profile › Password uses the same fields, meter and rules", async ({ page }) => {
    const email = `us-auth-15-profile-${randomUUID()}@example.com`;
    await page.goto("/signup");
    await page.getByLabel(/^Name/).fill("Owner");
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Password/).fill("TestPassword123!");
    await page.getByLabel(/^Confirm password/).fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");

    await page.goto("/profile?tab=password");
    await page.getByLabel(/^Current password/).fill("TestPassword123!");
    await page.getByLabel(/^New password/).fill("qwerty123");
    await page.getByLabel(/^Confirm new password/).fill("qwerty123");
    await expect(page.getByRole("status").filter({ hasText: "Password strength" })).toHaveText("Password strength: Weak");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("That password is too common. Choose another one.")).toBeVisible();

    await page.getByLabel(/^New password/).fill("Harbour-view-2027");
    await page.getByLabel(/^Confirm new password/).fill("Harbour-view-2027");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password changed.")).toBeVisible();
  });
});
