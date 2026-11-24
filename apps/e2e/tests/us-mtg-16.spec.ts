import { test, expect } from "@playwright/test";
import { local, meetingsOrg } from "./meetings-helpers";

test.describe("US-MTG-16", () => {
  test("view and date live in the address, survive reload and Back, and the last view is remembered", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await meetingsOrg(page);
    const meeting = await org.addMeeting("Slab pour review", local(2027, 3, 10, 9), local(2027, 3, 10, 10));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/meetings");

    await page.getByRole("radio", { name: "Month view" }).click();
    await expect(page).toHaveURL(/\/meetings\?view=month$/);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page).toHaveURL(/\/meetings\?view=month&date=\d{4}-\d{2}-\d{2}$/);
    const heading = await page.getByRole("button", { name: /^[A-Z][a-z]+ \d{4}$/ }).first().textContent();

    await page.reload();
    await expect(page.getByRole("radio", { name: "Month view" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: heading! })).toBeVisible();

    await page.goto("/contacts");
    await page.goBack();
    await expect(page.getByRole("radio", { name: "Month view" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("button", { name: heading! })).toBeVisible();

    // Plain /meetings opens the last view used on this device, on today.
    await page.goto("/meetings");
    await expect(page.getByRole("radio", { name: "Month view" })).toHaveAttribute("aria-checked", "true");

    // A meeting link (?id=) still opens it, and keeps the view and date.
    await page.waitForLoadState("networkidle");
    await page.goto(`/meetings?view=week&date=2027-03-10&id=${meeting.id}`);
    await expect(page).toHaveURL(/\/meetings\?view=week&date=2027-03-10$/);
    await expect(page.getByRole("dialog", { name: "Manage attendees" })).toBeVisible();
  });
});
