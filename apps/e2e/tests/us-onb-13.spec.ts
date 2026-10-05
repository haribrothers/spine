import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-ONB-13", () => {
  test("choosing Construction / Contracting sets up the site cost categories, listed on Expenses › Categories with a note", async ({ page }) => {
    await signUpNewOrg(page, { name: "Site Owner", email: `us-onb-13-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await page.getByRole("button", { name: /Site Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("settings-sections").getByRole("button", { name: "Industry template" }).click();
    const pane = dialog.getByTestId("settings-pane");
    await expect(
      pane.getByText(
        "Pre-enables milestones and retention on jobs, and job-costing defaults suited to site work. Sets up cost categories for materials, labour, subcontractors, plant hire, fuel and freight, and site overheads.",
      ),
    ).toBeVisible();
    await pane.getByText("Construction / Contracting").click();
    await pane.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved").first()).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/expenses/categories");
    await expect(
      page.getByText(
        "Set up by the Construction / Contracting template: 6 new categories and accounts 5300 Plant & Equipment Hire, 5400 Fuel & Freight and 5500 Site Overheads & Permits. These are ordinary categories — rename, remap or archive them like any other.",
      ),
    ).toBeVisible();
    for (const [name, account] of [
      ["Materials", "5000"],
      ["Subcontractors", "5100"],
      ["Site labour", "5200"],
      ["Plant & equipment hire", "5300"],
      ["Fuel & freight", "5400"],
      ["Site overheads & permits", "5500"],
    ]) {
      const item = page.getByText(name!, { exact: true }).locator("..");
      await expect(item).toContainText(`${account} ·`);
    }
  });
});
