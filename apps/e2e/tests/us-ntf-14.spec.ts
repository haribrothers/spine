import { test, expect } from "./fixtures";

test.describe("US-NTF-14", () => {
  test("Profile › Notifications: daily digest on/off, Send at and Days, beside browser notifications and meeting reminders", async ({ page, seededOrg: _ }) => {
    await page.goto("/profile");
    await page.getByRole("tab", { name: "Notifications" }).click();

    const digest = page.getByTestId("daily-digest");
    await expect(digest.getByRole("heading", { name: "Daily digest" })).toBeVisible();
    await expect(digest.getByText("Email me a summary each morning")).toBeVisible();
    const toggle = digest.getByRole("switch", { name: "Email me a summary each morning" });
    // Owners start with it on, 7:00 AM, Monday to Friday (D-093).
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(digest.getByRole("combobox", { name: "Send at" })).toHaveText("7:00 AM");
    await expect(digest.getByRole("combobox", { name: "Days" })).toHaveText("Monday to Friday");

    await digest.getByRole("combobox", { name: "Send at" }).click();
    await page.getByRole("option", { name: "6:30 AM" }).click();
    await expect(digest.getByRole("combobox", { name: "Send at" })).toHaveText("6:30 AM");
    await digest.getByRole("combobox", { name: "Days" }).click();
    await page.getByRole("option", { name: "Every day" }).click();
    await expect(page.getByText("Daily digest on: every day.")).toBeVisible();

    await toggle.click();
    await expect(page.getByText("Daily digest turned off.")).toBeVisible();

    // The same tab holds the other notification settings.
    await expect(page.getByTestId("browser-notifications")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Meeting reminders" })).toBeVisible();

    // Saved: a fresh load opens straight on the tab with the choices kept.
    await page.goto("/profile?tab=notifications");
    const reloaded = page.getByTestId("daily-digest");
    await expect(reloaded.getByRole("switch", { name: "Email me a summary each morning" })).toHaveAttribute("aria-checked", "false");
    await expect(reloaded.getByRole("combobox", { name: "Send at" })).toHaveText("6:30 AM");
    await expect(reloaded.getByRole("combobox", { name: "Days" })).toHaveText("Every day");
  });
});
