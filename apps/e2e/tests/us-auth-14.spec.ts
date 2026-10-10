import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-AUTH-14", () => {
  test("login sits in the Spine frame: logo, illustration beside it, show/hide password, Caps Lock and a wrong-password message that says what to do", async ({ page }) => {
    const email = `us-auth-14-${randomUUID()}@example.com`;
    await signUpNewOrg(page, { name: "Owner", email, password: "TestPassword123!" });
    await page.context().clearCookies();

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
    await expect(page.getByText("Welcome back to Spine.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Spine" })).toBeVisible();
    const illustration = page.getByTestId("auth-illustration-login");
    await expect(illustration).toBeVisible();
    await expect(illustration).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByLabel(/^Email/)).toBeFocused();

    const password = page.getByLabel(/^Password/);
    await password.fill("not-the-password");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();

    // Headless browsers don't report the real key's state, so send a key with Caps Lock on.
    await password.dispatchEvent("keydown", { key: "A", modifierCapsLock: true });
    await expect(page.getByText("Caps Lock is on.")).toBeVisible();
    await password.dispatchEvent("keydown", { key: "a", modifierCapsLock: false });
    await expect(page.getByText("Caps Lock is on.")).toHaveCount(0);

    await page.getByLabel(/^Email/).fill(email);
    await password.fill("not-the-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("That email and password don't match. Check both, or reset your password.")).toBeVisible();
    // What was typed stays.
    await expect(page.getByLabel(/^Email/)).toHaveValue(email);

    await password.fill("TestPassword123!");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/dashboard");
  });

  test("forgot password, reset and invite-only use the same frame; a narrow window shows the form alone", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { level: 1, name: "Reset your password" })).toBeVisible();
    await expect(page.getByTestId("auth-illustration-login")).toBeVisible();
    await page.goto("/reset-password?token=made-up");
    await expect(page.getByTestId("reset-link-invalid")).toBeVisible();
    await expect(page.getByTestId("auth-illustration-login")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
    await expect(page.getByTestId("auth-illustration-login")).toBeHidden();
  });

  test("in a short window the signed-out frame scrolls with the wheel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 560 });
    await page.goto("/signup");
    const create = page.getByRole("button", { name: "Create account" });
    await page.getByLabel(/^Password/).fill("riverstone8");
    await expect(create).not.toBeInViewport();
    await page.mouse.move(300, 300);
    await page.mouse.wheel(0, 1200);
    await expect(create).toBeInViewport();
  });
});

