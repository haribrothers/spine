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
    await expect(pane.getByText("Each person still chooses light or dark mode in their own Profile & Preferences.")).toBeVisible();

    const paidBefore = await cssVar(page, "--color-paid");
    // The whole card is the control (the radio itself is visually hidden).
    await pane.getByText("Harbour Teal", { exact: true }).click();
    await expect(pane.getByRole("radio", { name: /Harbour Teal/ })).toBeChecked();
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved").first()).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-brand", "harbour-teal");
    expect(await cssVar(page, "--color-primary")).toBe("#0d6e6e");
    expect(await cssVar(page, "--color-paid")).toBe(paidBefore);
    expect(await cssVar(page, "--color-overdue")).toBe("#b3261e");

    // Another member of the organisation, in dark mode.
    const context = await browser.newContext();
    const other = await context.newPage();
    await other.addInitScript({ content: `localStorage.setItem("theme", "dark");` });
    await logIn(other, DEMO_FIELD_USER);
    await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(other.locator("html")).toHaveAttribute("data-brand", "harbour-teal");
    expect(await cssVar(other, "--color-primary")).toBe("#4fd1d1");
    expect(await cssVar(other, "--color-paid")).toBe("#4ade94");
    await context.close();

    const again = await openBranding(page);
    await again.getByRole("button", { name: "Reset to Spine defaults" }).click();
    await again.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved").first()).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-brand", "spine-blue");
    expect(await cssVar(page, "--color-primary")).toBe("#2954e5");
  });
});
