import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

/** Signs up and presses Continue through the wizard until the Tax step asks for the country. */
async function reachTaxStep(page: Page, name: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(`e2e-tax-09-${randomUUID()}@example.com`);
  await page.getByLabel(/^Password/).fill("e2e-test-password-1");
  await page.getByLabel(/^Confirm password/).fill("e2e-test-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Set up my business" }).click();
  await page.getByLabel(/^Business name/).fill(`${name} Ltd`);
  const question = page.getByText("Where is your business registered for tax? Spine sets up your country's rates — change them any time in Settings › Tax.");
  for (let i = 0; i < 6 && !(await question.isVisible()); i++) {
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForTimeout(300);
  }
  await expect(question).toBeVisible();
}

test.describe("US-TAX-09", () => {
  test("India sets up GST in the wizard; changing country in Settings adds rates and keeps the old ones", async ({ page }) => {
    await reachTaxStep(page, "Kaveri");
    const radios = page.getByRole("radiogroup", { name: "Tax country" });
    for (const label of ["India (GST)", "United Kingdom (VAT)", "Australia (GST)", "New Zealand (GST)", "United Arab Emirates (VAT)", "Saudi Arabia (VAT)", "Another country — I'll add my own rates"]) {
      await expect(radios.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("CGST, SGST, IGST and cess at the current slabs. GST details come next.")).toBeVisible();
    await radios.getByText("India (GST)", { exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    // GST settings open next (US-TAX-12).
    await expect(page.getByText("GST details", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Not registered yet — skip this step" }).click();
    await page.getByRole("button", { name: "Skip to dashboard" }).click();
    await page.waitForURL("**/dashboard");

    await page.goto("/dashboard?settings=tax");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await expect(pane.getByRole("combobox", { name: "Country" })).toHaveText("India (GST)");
    await expect(pane.getByText("Changing country adds that country's rates. Existing rates are never changed or deleted.")).toBeVisible();
    await expect(pane.getByText("CGST 9%", { exact: true })).toBeVisible();
    await expect(pane.getByText("CGST (9%) + SGST (9%) · Intra-state")).toBeVisible();
    await expect(pane.getByText("18% · IGST")).toBeVisible();

    await pane.getByRole("combobox", { name: "Country" }).click();
    await page.getByRole("option", { name: "United Kingdom (VAT)" }).click();
    await expect(pane.getByText("Added 4 rates. Your existing rates are unchanged — archive the ones you no longer use.")).toBeVisible();
    await expect(pane.getByText("VAT 20%", { exact: true })).toBeVisible();
    await expect(pane.getByText("CGST 9%", { exact: true })).toBeVisible();
  });

  test("another country keeps the single default rate step", async ({ page }) => {
    await reachTaxStep(page, "Elsewhere");
    await page.getByRole("radiogroup", { name: "Tax country" }).getByText("Another country — I'll add my own rates").click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Default tax rate")).toBeVisible();
    await expect(page.getByText("Confirm the rate your first quote should use.")).toBeVisible();
    await expect(page.getByLabel("Tax name")).toBeVisible();
  });
});
