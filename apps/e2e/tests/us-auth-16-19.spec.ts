import { randomUUID } from "node:crypto";
import type { Browser, Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { test, expect, logIn } from "./fixtures";
import { signUpNewOrg } from "./helpers";

const toasts = (page: Page) => page.locator('[data-testid="toast"]');

/** Another device: a fresh browser signed in as the same person. */
async function otherDevice(browser: Browser, credentials: { email: string; password: string }): Promise<Page> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  await logIn(page, credentials);
  return page;
}

test.describe("US-AUTH-16 to US-AUTH-19", () => {
  test("US-AUTH-16: the theme chosen in the user menu is saved and follows the person to another device", async ({ page, browser, seededOrg }) => {
    const owner = { email: seededOrg.ownerEmail, password: seededOrg.ownerPassword };
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /E2E Seeded Owner/ }).last().click();
    const theme = page.getByTestId("theme-switch");
    await expect(theme.getByRole("menuitemradio", { name: "Follow system" })).toBeVisible();
    // The open menu (Radix hides the page behind it).
    await expectNoAxeViolations(page, [".h-screen"]);
    await theme.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.keyboard.press("Escape");

    const laptop = await otherDevice(browser, owner);
    await expect(laptop.locator("html")).toHaveAttribute("data-theme", "dark");
    await laptop.context().close();

    // Back to following the system, for the other specs.
    await page.getByRole("button", { name: /E2E Seeded Owner/ }).last().click();
    await page.getByTestId("theme-switch").getByRole("menuitemradio", { name: "Follow system" }).click();
    await expect(page.getByTestId("theme-switch").getByRole("menuitemradio", { name: "Follow system" })).toHaveAttribute("aria-checked", "true");
  });

  test("US-AUTH-17: see where you're signed in and sign another device out", async ({ page, browser, seededOrg }) => {
    const owner = { email: seededOrg.ownerEmail, password: seededOrg.ownerPassword };
    const phone = await otherDevice(browser, owner);
    await page.goto("/dashboard?settings=security");
    const sessions = page.getByTestId("account-sessions");
    await expect(sessions.getByRole("listitem").first()).toContainText("This device");
    await expect(sessions.getByRole("listitem")).not.toHaveCount(1);
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Sign out of other devices" }).click();
    const confirm = page.getByRole("alertdialog", { name: /Sign out of \d+ other devices?/ });
    await confirm.getByRole("button", { name: /Sign out \d+ devices?/ }).click();
    await expect(toasts(page).filter({ hasText: /Signed out of \d+ other devices?/ })).toBeVisible();
    await expect(sessions.getByRole("listitem")).toHaveCount(1);

    await phone.goto("/dashboard");
    await phone.waitForURL(/\/login/);
    await phone.context().close();
  });

  test("US-AUTH-18 and US-AUTH-19: change the sign-in email with the password; Save waits for a change", async ({ page }) => {
    const email = `us-auth-18-${randomUUID()}@example.com`;
    await signUpNewOrg(page, { name: "Priya Raman", email, password: "TestPassword123!" });
    await page.goto("/dashboard?settings=profile");
    const pane = page.getByTestId("account-profile");
    await expect(pane.getByTestId("account-email")).toHaveText(email);

    // US-AUTH-19: Save is off until the name changes; no photo, so no Remove photo.
    const save = pane.getByRole("button", { name: "Save" });
    await expect(save).toBeDisabled();
    await expect(pane.getByRole("button", { name: "Remove photo" })).toHaveCount(0);
    await pane.getByRole("textbox", { name: "Name" }).fill("Priya R. Raman");
    await save.click();
    await expect(toasts(page).filter({ hasText: "Profile updated." })).toBeVisible();
    await expect(save).toBeDisabled();

    // US-AUTH-18: the password is checked, then the email changes.
    await pane.getByRole("button", { name: "Change email" }).click();
    const dialog = page.getByRole("dialog", { name: "Change your sign-in email" });
    const next = `us-auth-18-new-${randomUUID()}@example.com`;
    await dialog.getByLabel("New email").fill(next);
    await dialog.getByLabel("Current password").fill("not-my-password");
    await dialog.getByRole("button", { name: "Change email" }).click();
    await expect(dialog).toContainText("That password isn't right.");
    await dialog.getByLabel("Current password").fill("TestPassword123!");
    await dialog.getByRole("button", { name: "Change email" }).click();
    await expect(toasts(page).filter({ hasText: `Your sign-in email is now ${next}.` })).toBeVisible();
    await expect(pane.getByTestId("account-email")).toHaveText(next);

    // US-AUTH-19: Notifications name the business's defaults.
    await page.getByTestId("settings-sections").getByRole("button", { name: "Notifications" }).click();
    await expect(page.getByTestId("account-notifications")).toContainText("Business default · 15 min");
    await expect(page.getByTestId("account-notifications")).toContainText(/Times are in .+, the business's time zone\./);
  });
});
