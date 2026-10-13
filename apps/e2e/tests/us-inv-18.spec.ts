import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function openReminders(page: Page) {
  await page.getByRole("button", { name: /E2E Seeded Owner/ }).last().click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("settings-sections").getByRole("button", { name: "Automatic reminders" }).click();
  return dialog.getByTestId("settings-pane");
}

test.describe("US-INV-18", () => {
  test("reminders are off by default with the schedule, need at least one day when on, save, and preview the email", async ({ page, seededOrg: _ }) => {
    const pane = await openReminders(page);
    await expect(pane.getByRole("switch", { name: "Send reminders automatically" })).not.toBeChecked();
    for (const label of ["3 days before the due date", "On the due date", "7 days after the due date", "14 days after the due date", "Every 14 days after that, up to 3 more times"]) {
      await expect(pane.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(pane.getByRole("combobox", { name: "Send at" })).toHaveText("9:00 AM (organisation time)");

    await pane.getByRole("switch", { name: "Send reminders automatically" }).click();
    for (const label of ["On the due date", "7 days after the due date", "14 days after the due date"]) await pane.getByLabel(label).uncheck();
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(pane.getByText("Pick at least one reminder.")).toBeVisible();

    await pane.getByLabel("7 days after the due date").check();
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();

    await pane.getByRole("button", { name: "Preview email" }).click();
    const preview = page.getByRole("dialog", { name: "Reminder email preview" });
    // The most overdue unpaid invoice: a demo one (DEMO-INV-…, US-ONB-17), or one an earlier test in this
    // shared seeded org created after the demo's were settled (e.g. US-DASH-13's INV-0001).
    await expect(preview.getByText(/Subject: Reminder: invoice (DEMO-)?INV-\d+ is \d+ days? overdue/)).toBeVisible();
    await expect(preview.locator("iframe")).toBeVisible();
  });
});
