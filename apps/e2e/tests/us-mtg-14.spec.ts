import { test, expect } from "@playwright/test";
import { local, meetingsOrg } from "./meetings-helpers";

test.describe("US-MTG-14", () => {
  test("New meeting opens the dialog at 9:00 AM on the shown day; Week opens at 8 AM; a now line marks today", async ({ page }) => {
    test.setTimeout(120_000);
    await meetingsOrg(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/meetings?view=week&date=2027-03-10");

    // Week opens with 8 AM at the top, just under the day headers.
    const calendar = page.getByTestId("meetings-calendar");
    const header = calendar.locator("[data-calendar-sticky]");
    const eight = calendar.locator('[data-hour="8"]');
    await expect.poll(async () => Math.round((await eight.boundingBox())!.y - ((await header.boundingBox())!.y + (await header.boundingBox())!.height))).toBeLessThanOrEqual(12);
    await expect(calendar.locator("[data-now-line]")).toHaveCount(0);

    await page.getByRole("button", { name: "New meeting" }).click();
    const dialog = page.getByRole("dialog", { name: "New event" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Start")).toHaveValue("2027-03-10T09:00");
    await expect(dialog.getByLabel("End")).toHaveValue("2027-03-10T09:30");
    await dialog.getByLabel("Title").fill("Site handover");
    await dialog.getByRole("button", { name: "Create event" }).click();
    await expect(calendar.getByRole("button", { name: /^Site handover, 9:00 AM to 9:30 AM/ })).toBeVisible();

    // Today: a now line on today's column.
    await page.goto("/meetings?view=week");
    await expect(calendar.locator("[data-now-line]")).toHaveCount(1);
  });

  test("a late meeting's quick view stays inside the window", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await meetingsOrg(page);
    await org.addMeeting("Late review", local(2027, 3, 10, 22), local(2027, 3, 10, 23));
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/meetings?view=week&date=2027-03-10");
    const event = page.getByRole("button", { name: /^Late review, 10:00 PM to 11:00 PM/ });
    await event.scrollIntoViewIfNeeded();
    await event.click();
    const pop = page.getByRole("dialog").filter({ hasText: "Late review" });
    await expect(pop).toBeVisible();
    await expect(pop.getByText("Attendees")).toBeVisible();
    const box = (await pop.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(720);
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
  });

  test("without the right to create meetings there's no New meeting button", async ({ page }) => {
    test.setTimeout(120_000);
    await meetingsOrg(page);
    await page.route("**/org/members/me/capabilities", async (route) => {
      const res = await route.fetch();
      const caps = (await res.json()) as Record<string, boolean>;
      await route.fulfill({ response: res, json: { ...caps, "meetings.edit_own": false } });
    });
    await page.goto("/meetings");
    await expect(page.getByRole("radio", { name: "Week view" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New meeting" })).toHaveCount(0);
  });
});
