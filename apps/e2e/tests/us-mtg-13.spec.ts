import { test, expect } from "@playwright/test";
import { local, meetingsOrg, miniDay } from "./meetings-helpers";

test.describe("US-MTG-13", () => {
  test("the mini calendar dots busy days, says how many, shades the week on screen, follows the main view and loads other months", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await meetingsOrg(page);
    await org.addMeeting("Slab pour review", local(2027, 3, 10, 9), local(2027, 3, 10, 10), { contactId: org.contactId });
    await org.addMeeting("Quote walkthrough", local(2027, 3, 10, 16), local(2027, 3, 10, 17));
    await org.addMeeting("Weekly site planning", local(2027, 3, 8, 9), local(2027, 3, 8, 9, 45), {
      recurrence: { frequency: "weekly", interval: 1, end: { type: "count", count: 3 } },
    });
    await org.addMeeting("Board update", local(2027, 7, 14, 14), local(2027, 7, 14, 15));

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/meetings?view=week&date=2027-03-10");
    const busy = miniDay(page, /^Wednesday, March 10, 2027, 2 meetings$/);
    await expect(busy).toHaveAttribute("data-marked", "true");
    for (const d of [8, 15, 22]) await expect(miniDay(page, new RegExp(`March ${d}, 2027, 1 meeting$`))).toHaveAttribute("data-marked", "true");
    await expect(miniDay(page, /^Thursday, March 11, 2027$/)).not.toHaveAttribute("data-marked");

    // Hover says the count.
    await busy.hover();
    await expect(page.getByRole("tooltip", { name: "Wednesday, March 10 · 2 meetings" })).toBeVisible();

    // The week on screen is shaded; the next week isn't.
    await expect(miniDay(page, /^Sunday, March 7, 2027/)).toHaveAttribute("data-in-range", "true");
    await expect(miniDay(page, /^Saturday, March 13, 2027/)).toHaveAttribute("data-in-range", "true");
    await expect(miniDay(page, /^Sunday, March 14, 2027/)).not.toHaveAttribute("data-in-range");

    // Unticking the organiser's calendar takes their dots away.
    const sidebar = page.getByRole("complementary", { name: "Calendar sidebar" });
    await sidebar.locator("label", { hasText: org.ownerName }).getByRole("checkbox").click();
    await expect(miniDay(page, /^Wednesday, March 10, 2027$/)).not.toHaveAttribute("data-marked");
    await sidebar.locator("label", { hasText: org.ownerName }).getByRole("checkbox").click();
    await expect(miniDay(page, /^Wednesday, March 10, 2027, 2 meetings$/)).toBeVisible();

    // The main view moving into April takes the mini calendar with it.
    await page.goto("/meetings?view=month&date=2027-03-10");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(sidebar.getByRole("grid", { name: "April 2027" })).toBeVisible();

    // Paging the mini calendar beyond what's loaded loads that month's dots.
    for (let i = 0; i < 3; i++) await sidebar.getByRole("button", { name: "Next month" }).click();
    await expect(sidebar.getByRole("grid", { name: "July 2027" })).toBeVisible();
    await expect(miniDay(page, /^Wednesday, July 14, 2027, 1 meeting$/)).toHaveAttribute("data-marked", "true");
  });
});
