import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test.describe("US-AUTH-09", () => {
  test("'Forgot password?' on login opens the reset page with its copy", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await page.waitForURL("**/forgot-password");
    await expect(page.getByText("Reset your password")).toBeVisible();
    await expect(page.getByText("Enter the email you sign in with and we'll send you a link to choose a new password.")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
    await expect(page.getByText("The link works once and expires in 1 hour.")).toBeVisible();
    await page.getByRole("link", { name: "Back to log in" }).click();
    await page.waitForURL("**/login");
  });

  test("any email gets 'Check your email', and resending waits 60 seconds", async ({ page }) => {
    await page.clock.install();
    const email = `nobody-${randomUUID()}@example.com`;
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.waitForURL("**/forgot-password/sent");

    const sent = page.getByTestId("forgot-password-sent");
    await expect(sent).toContainText("Check your email");
    await expect(sent).toContainText(
      `If an account exists for ${email}, we've sent a link to reset its password. The link works once and expires in 1 hour.`,
    );
    const resend = sent.getByRole("button", { name: /^Resend link in \d:\d\d$/ });
    await expect(resend).toBeDisabled();

    await page.clock.fastForward(15_000);
    await expect(sent.getByRole("button", { name: /^Resend link in 0:(4[5-9])$/ })).toBeDisabled();

    await page.clock.fastForward(46_000);
    const ready = sent.getByRole("button", { name: "Resend link" });
    await expect(ready).toBeEnabled();
    await ready.click();
    await expect(sent.getByRole("button", { name: /^Resend link in \d:\d\d$/ })).toBeDisabled();
  });

  test("the sent page without a request goes back to the form", async ({ page }) => {
    await page.goto("/forgot-password/sent");
    await page.waitForURL("**/forgot-password");
  });
});
