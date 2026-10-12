import type { Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { test, expect } from "./fixtures";

const toasts = (page: Page) => page.locator('[data-testid="toast"]');
const row = (page: Page, name: string) => page.getByTestId("users-table").getByRole("row").filter({ hasText: name });
/** The demo's Staff user. The test ends with their usual password back, since the seeded organisation is shared. */
const SARAH = { name: "Sarah Mendes", email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };
const GIVEN = "copper-Tide-48-lantern";

test.describe("US-TEAM-24", () => {
  test("an Owner sets a Staff member's password; at next sign-in they choose their own first", async ({ page, seededOrg, browser }) => {
    void seededOrg;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/team/users");

    // Only Staff and Field rows offer it; never an Owner's, never your own.
    const me = page.getByTestId("users-table").getByRole("row").filter({ hasText: "You" });
    await me.getByRole("button", { name: /^Actions for / }).click();
    await expect(page.getByRole("menuitem", { name: "Change password" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await row(page, SARAH.name).getByRole("button", { name: `Actions for ${SARAH.name}` }).click();
    await page.getByRole("menuitem", { name: "Change password" }).click();
    const dialog = page.getByRole("dialog", { name: `Change ${SARAH.name}’s password` });
    const field = dialog.getByRole("textbox", { name: "New password" });
    // A strong suggestion, shown so it can be passed on.
    await expect(field).toHaveValue(/^[a-zA-Z]+-[a-zA-Z]+-\d\d-[a-zA-Z]+$/);
    await expect(dialog).toContainText("Strong");
    await expect(dialog.getByTestId("password-what-happens")).toContainText("Sarah is signed out on every device, web and phone.");
    await expectNoAxeViolations(page);
    await field.fill(GIVEN);
    await dialog.getByRole("button", { name: "Change password" }).click();
    await expect(toasts(page).filter({ hasText: "Sarah Mendes's password changed" })).toContainText("They're signed out everywhere");

    // Sarah signs in with it and lands on "Choose your own password".
    const context = await browser.newContext();
    const sarah = await context.newPage();
    await sarah.goto("/login");
    await sarah.getByLabel("Email").fill(SARAH.email);
    await sarah.getByLabel(/^Password/).fill(GIVEN);
    await sarah.getByRole("button", { name: "Log in" }).click();
    await sarah.waitForURL("**/choose-password**");
    await expect(sarah.getByRole("heading", { name: "Choose your own password" })).toBeVisible();
    await expect(sarah.getByText(/E2E Seeded Owner set a password for you/)).toBeVisible();
    await expectNoAxeViolations(sarah);

    // Another page sends them back here.
    await sarah.goto("/contacts");
    await sarah.waitForURL("**/choose-password**");

    // Not the one they were given.
    await sarah.getByLabel(/^New password/).fill(GIVEN);
    await sarah.getByLabel(/^Confirm password/).fill(GIVEN);
    await sarah.getByRole("button", { name: "Save and continue" }).click();
    await expect(sarah.getByText("That's the password you were given. Choose a different one.")).toBeVisible();

    // Their own — here the demo's usual one, so the shared organisation is as it was.
    await sarah.getByLabel(/^New password/).fill(SARAH.password);
    await sarah.getByLabel(/^Confirm password/).fill(SARAH.password);
    await sarah.getByRole("button", { name: "Save and continue" }).click();
    await sarah.waitForURL(/\/(dashboard|contacts)/);
    await expect(sarah.getByRole("main")).toBeVisible();
    await context.close();
  });
});
