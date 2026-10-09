import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { clearInbox, extractLink, signUpNewOrg, waitForEmail } from "./helpers";

test.describe("US-AUTH-10", () => {
  test("a reset link sets a new password, signs out other devices and can't be used twice", async ({ browser, page }) => {
    const email = `us-auth-10-${randomUUID()}@example.com`;
    const oldPassword = "OldPassword123!";
    const newPassword = "NewPassword456!";
    // This page is the "other device": signed in before the reset.
    await signUpNewOrg(page, { name: "Sam Lee", email, password: oldPassword });

    const phone = await browser.newContext();
    const resetPage = await phone.newPage();
    await clearInbox();
    await resetPage.goto("/forgot-password");
    await resetPage.getByLabel("Email").fill(email);
    await resetPage.getByRole("button", { name: "Send reset link" }).click();
    await resetPage.waitForURL("**/forgot-password/sent");

    const message = await waitForEmail((m) => m.to.some((t) => t.address === email) && m.subject === "Reset your Spine password");
    const link = extractLink(message);
    expect(link).toContain("/reset-password?token=");

    await resetPage.goto(link);
    await expect(resetPage.getByText("Choose a new password")).toBeVisible();
    await expect(resetPage.getByText(`For ${email}. You'll be signed out on your other devices.`)).toBeVisible();
    await expect(resetPage.getByText("At least 8 characters.")).toBeVisible();

    await resetPage.getByLabel(/^New password/).fill(newPassword);
    await resetPage.getByLabel("Confirm new password").fill("Different789!");
    await resetPage.getByRole("button", { name: "Save password" }).click();
    await expect(resetPage.getByText("The passwords don't match.")).toBeVisible();
    await expect(resetPage).toHaveURL(/\/reset-password/);

    await resetPage.getByLabel("Confirm new password").fill(newPassword);
    await resetPage.getByRole("button", { name: "Save password" }).click();
    await resetPage.waitForURL("**/dashboard");

    // The session from before the reset is gone.
    await page.goto("/dashboard");
    await page.waitForURL(/\/login\?next=%2Fdashboard$/);

    // The old password no longer works; the new one does.
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/^Password/).fill(oldPassword);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByLabel(/^Password/).fill(newPassword);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL("**/dashboard");

    // The link works once.
    await resetPage.goto(link);
    const invalid = resetPage.getByTestId("reset-link-invalid");
    await expect(invalid).toContainText("This link can't be used");
    await invalid.getByRole("link", { name: "Request a new one" }).click();
    await resetPage.waitForURL("**/forgot-password");
    await phone.close();
  });

  test("a made-up token shows that the link can't be used", async ({ page }) => {
    await page.goto(`/reset-password?token=${randomUUID()}`);
    await expect(page.getByTestId("reset-link-invalid")).toContainText("This link can't be used");
    await expect(page.getByRole("link", { name: "Request a new one" })).toBeVisible();
  });
});
