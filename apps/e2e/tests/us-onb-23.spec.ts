import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test.describe("US-ONB-23", () => {
  test("Finish shows what was set and what to do next; the dashboard follows, and onboarding doesn't come back", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Finish Owner");
    await page.getByLabel("Email").fill(`e2e-onb-23-${randomUUID()}@example.com`);
    await page.getByLabel(/^Password/).fill("e2e-test-password-1");
    await page.getByLabel(/^Confirm password/).fill("e2e-test-password-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");

    await page.getByRole("button", { name: "Set up my business" }).click();
    await page.getByLabel(/^Business name/).fill("Cedar Row Joinery");
    // Continue through every step to the Team step.
    for (let i = 0; i < 12; i++) {
      if (await page.getByRole("heading", { name: "Invite your team" }).isVisible()) break;
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForTimeout(300);
    }
    await expect(page.getByRole("heading", { name: "Invite your team" })).toBeVisible();
    await page.getByRole("button", { name: "Skip — finish setup" }).click();

    const finish = page.getByTestId("onboarding-finish");
    await expect(finish.getByRole("heading", { level: 1, name: "You're set up" })).toBeVisible();
    await expect(finish.getByText("Spine is ready for Cedar Row Joinery.")).toBeVisible();
    await expect(finish.getByText("Just you for now")).toBeVisible();
    await expect(finish.getByText("First invoice INV-0001")).toBeVisible();
    await expect(finish.getByRole("link", { name: /Add your first customer/ })).toHaveAttribute("href", "/contacts/new");
    await expect(finish.getByRole("link", { name: /Add something you sell/ })).toHaveAttribute("href", "/catalog");
    await expect(finish.getByRole("link", { name: /Send your first quote/ })).toHaveAttribute("href", "/quotes/new");
    await expect(finish.getByRole("link", { name: /^See what's left to set up — \d+ left$/ })).toHaveAttribute("href", "/setup");

    // "Change" opens the matching Settings pane over the finish screen.
    await finish.getByRole("button", { name: "Change money" }).click();
    await expect(page.getByRole("dialog").getByText("Controls date and number formatting.")).toBeVisible();
    await page.keyboard.press("Escape");

    // A refresh, now that onboarding is finished, goes to the dashboard.
    await page.reload();
    await page.waitForURL("**/dashboard");
    await page.goto("/onboarding");
    await page.waitForURL("**/dashboard");
  });

  test("Go to dashboard leaves the finish screen", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Quick Owner");
    await page.getByLabel("Email").fill(`e2e-onb-23-${randomUUID()}@example.com`);
    await page.getByLabel(/^Password/).fill("e2e-test-password-1");
    await page.getByLabel(/^Confirm password/).fill("e2e-test-password-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");
    await page.getByRole("button", { name: "Set up my business" }).click();
    await page.getByLabel(/^Business name/).fill("Quick Fix Plumbing");
    for (let i = 0; i < 12; i++) {
      if (await page.getByRole("heading", { name: "Invite your team" }).isVisible()) break;
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("button", { name: "Skip — finish setup" }).click();
    await page.getByRole("button", { name: "Go to dashboard" }).click();
    await page.waitForURL("**/dashboard");
  });
});
