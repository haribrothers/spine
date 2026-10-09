import { randomUUID } from "node:crypto";
import { test as base, expect as baseExpect } from "@playwright/test";
import { test, expect } from "./fixtures";

base.describe("US-OPS-21 · onboarding", () => {
  base("Financial year and Team steps read in plain language", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Name").fill("Owner");
    await page.getByLabel("Email").fill(`us-ops-21-${randomUUID()}@example.com`);
    await page.getByLabel(/^Password/).fill("TestPassword123!");
    await page.getByLabel(/^Confirm password/).fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/onboarding");

    await page.getByRole("button", { name: "Set up my business" }).click();
    await page.getByLabel(/^Business name/).fill("Riverstone Builders");
    await baseExpect(page.getByText("the next step picks a template")).toBeVisible();

    let sawFinancialYear = false;
    for (let i = 0; i < 10; i++) {
      if (await page.getByRole("heading", { name: "Invite your team" }).isVisible()) break;
      // US-ONB-22: the rail lists every step's name, so look for the step's heading.
      if (await page.getByRole("heading", { name: "Financial year", exact: true }).isVisible()) {
        sawFinancialYear = true;
        await baseExpect(page.getByText("Document numbers never reset.")).toBeVisible();
        await baseExpect(page.getByText(/sequences reset/i)).toHaveCount(0);
      }
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.waitForTimeout(300);
    }
    baseExpect(sawFinancialYear).toBe(true);
    await baseExpect(page.getByText("You can invite people later from Team › Users.")).toBeVisible();
  });
});

test.describe("US-OPS-21 · app", () => {
  test("a void invoice's balance shows '—'; Settings and builders have no developer wording", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/invoices");
    const voidRow = page.locator("tbody tr", { hasText: /void/i }).first();
    await expect(voidRow).toBeVisible();
    await expect(voidRow.locator("td").filter({ hasText: /^—$/ })).toHaveCount(1);

    await page.goto("/quotes/new");
    await expect(page.getByText("Quote shows as expired after this date.")).toBeVisible();
    await expect(page.getByText(/\(S-\d{2}\.\d+\)/)).toHaveCount(0);

    await page.getByRole("button", { name: /E2E Seeded Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("What your business does, in your own words.")).toBeVisible();
    await expect(dialog.getByText(/next step/i)).toHaveCount(0);
    await dialog.getByTestId("settings-sections").getByRole("button", { name: "Financial year" }).click();
    await expect(dialog.getByText("Document numbers never reset.", { exact: false })).toBeVisible();
    await expect(dialog.getByText(/sequences reset/i)).toHaveCount(0);
  });
});
