import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";
import type { Page } from "@playwright/test";

// Strings, not functions: this package has no DOM types.
const cssVar = (page: Page, name: string) => page.evaluate(`getComputedStyle(document.documentElement).getPropertyValue("${name}").trim()`);

async function openBranding(page: Page) {
  await page.getByRole("button", { name: /E2E Seeded Owner/ }).last().click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("settings-sections").getByRole("button", { name: "Branding" }).click();
  return dialog.getByTestId("settings-pane");
}

test.describe("US-SET-09", () => {
  test("an Owner picks Harbour Teal; every member gets it in light and dark mode; status colours stay; reset returns Spine Blue", async ({ page, browser, seededOrg: _ }) => {
    const pane = await openBranding(page);
    await expect(pane.getByRole("group", { name: "App theme" })).toBeVisible();
    for (const label of ["Spine Blue", "Harbour Teal", "Plum", "Graphite"]) await expect(pane.getByText(label, { exact: true })).toBeVisible();
    await expect(pane.getByText("Default", { exact: true })).toBeVisible();
    await expect(pane.getByText("Each person still chooses light or dark mode from their user menu.")).toBeVisible();

    const paidBefore = await cssVar(page, "--color-paid");
    // The whole card is the control (the radio itself is visually hidden).
    await pane.getByText("Harbour Teal", { exact: true }).click();
    await expect(pane.getByRole("radio", { name: /Harbour Teal/ })).toBeChecked();
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-brand", "harbour-teal");
    await expect.poll(() => cssVar(page, "--color-primary")).toBe("#0d6e6e");
    await expect.poll(() => cssVar(page, "--color-paid")).toBe(paidBefore);
    await expect.poll(() => cssVar(page, "--color-overdue")).toBe("#b3261e");

    // Another member of the organisation, in dark mode.
    const context = await browser.newContext();
    const other = await context.newPage();
    await logIn(other, DEMO_FIELD_USER);
    // US-AUTH-16: they choose dark from their user menu.
    await other.getByRole("button", { name: /Your account/ }).last().click();
    await other.getByTestId("theme-switch").getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(other.locator("html")).toHaveAttribute("data-brand", "harbour-teal");
    await expect.poll(() => cssVar(other, "--color-primary")).toBe("#4fd1d1");
    await expect.poll(() => cssVar(other, "--color-paid")).toBe("#4ade94");
    await other.getByTestId("theme-switch").getByRole("menuitemradio", { name: "Follow system" }).click();
    await context.close();

    // US-SET-33: the reload kept Settings open on Branding.
    await expect(page).toHaveURL(/settings=branding/);
    const again = page.getByTestId("settings-pane");
    await again.getByRole("button", { name: "Reset to Spine defaults" }).click();
    await again.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-brand", "spine-blue");
    await expect.poll(() => cssVar(page, "--color-primary")).toBe("#2954e5");
  });
});
