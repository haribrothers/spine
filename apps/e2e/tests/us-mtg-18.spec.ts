import { test, expect, type Page } from "@playwright/test";
import { local, meetingsOrg } from "./meetings-helpers";

const PHONE = { width: 390, height: 844 };

/** A swipe across `selector`, right to left (`dir` -1) or left to right (1). */
async function swipe(page: Page, selector: string, dir: -1 | 1) {
  const box = (await page.locator(selector).first().boundingBox())!;
  const y = box.y + Math.min(box.height / 2, 120);
  const from = dir < 0 ? box.x + box.width - 30 : box.x + 30;
  await page.mouse.move(from, y);
  await page.mouse.down();
  await page.mouse.move(from + dir * 160, y + 4, { steps: 6 });
  await page.mouse.up();
}

test.describe("US-MTG-18 · use a calendar made for my phone", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test("Month: a compact grid with dots, the chosen day's meetings under it; tap a day, arrows and swipes change the month, Today returns", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await meetingsOrg(page);
    await org.addMeeting("Slab pour review", local(2027, 3, 10, 9), local(2027, 3, 10, 10), { contactId: org.contactId, location: "Outer Ring Road" });
    await org.addMeeting("Crew briefing", local(2027, 3, 10, 14), local(2027, 3, 10, 14, 30), { color: "green" });
    await org.addMeeting("Site handover", local(2027, 3, 11, 11), local(2027, 3, 11, 12));
    await page.goto("/meetings?date=2027-03-10");

    // With no view in the address, a phone opens on the month.
    await expect(page.getByRole("radio", { name: "Month view" })).toHaveAttribute("aria-checked", "true");
    const grid = page.getByTestId("calendar-phone-month");
    const tenth = grid.getByRole("button", { name: /Wednesday 10 March, 2 meetings/ });
    await expect(tenth).toHaveAttribute("aria-pressed", "true");
    // Two dots, in their calendars' colours.
    await expect(tenth.locator("span.rounded-full.h-1\\.5")).toHaveCount(2);

    const list = page.getByTestId("calendar-phone-day-list");
    await expect(list).toContainText("Wednesday 10 March");
    await expect(list).toContainText("2 meetings");
    const row = list.getByRole("button", { name: /Slab pour review/ });
    await expect(row).toContainText("9:00 AM");
    await expect(row).toContainText("Outer Ring Road");
    await expect(row).toContainText("Halcyon Tech Parks Pvt Ltd");

    // Tap a day: it's chosen and its meetings show.
    await grid.getByRole("button", { name: /Thursday 11 March/ }).click();
    await expect(list).toContainText("Site handover");

    // Arrows and swipes move a month.
    const toolbar = page.locator("[data-calendar-phone-toolbar]");
    await toolbar.getByRole("button", { name: "Next" }).click();
    await expect(toolbar).toContainText("April 2027");
    await swipe(page, "[data-testid=calendar-phone-month]", 1);
    await expect(toolbar).toContainText("March 2027");
    await swipe(page, "[data-testid=calendar-phone-month]", -1);
    await expect(toolbar).toContainText("April 2027");

    // Today returns to today.
    await toolbar.getByRole("button", { name: "Today" }).click();
    const now = new Date();
    await expect(grid.locator('[aria-current="date"]')).toHaveAttribute("aria-pressed", "true");
    await expect(toolbar).toContainText(String(now.getFullYear()));

    // A meeting opens its quick view as a bottom sheet.
    await page.goto("/meetings?date=2027-03-10&view=month");
    await page.getByTestId("calendar-phone-day-list").getByRole("button", { name: /Slab pour review/ }).click();
    const sheet = page.getByTestId("calendar-quick-view-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Slab pour review");
    const s = (await sheet.boundingBox())!;
    expect(s.y + s.height).toBeGreaterThan(PHONE.height - 4);
  });

  test("Day: a week strip with dots over the day's timeline; the strip swipes a week, the timeline a day, a line marks now", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await meetingsOrg(page);
    await org.addMeeting("Slab pour review", local(2027, 3, 10, 9), local(2027, 3, 10, 10));
    await page.goto("/meetings?date=2027-03-10&view=day");
    const strip = page.getByTestId("calendar-week-strip");
    await expect(strip.getByRole("button")).toHaveCount(7);
    await expect(strip.getByRole("button", { name: /Wednesday 10 March, 1 meeting/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /Slab pour review/ }).first()).toBeVisible();

    await swipe(page, "[data-testid=calendar-week-strip]", -1);
    await expect(strip.getByRole("button", { name: /Wednesday 17 March/ })).toHaveAttribute("aria-pressed", "true");
    await swipe(page, "[data-testid=meetings-calendar] .overflow-auto", 1);
    await expect(strip.getByRole("button", { name: /Tuesday 16 March/ })).toHaveAttribute("aria-pressed", "true");

    // On today, a line marks now.
    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.locator("[data-now-line]")).toHaveCount(1);
  });

  test("the toolbar is two short rows: the month (tap to pick another), arrows and Today, then Month · Day · Agenda the width of the screen; Calendars from the top bar; + opens New meeting on the chosen day", async ({ page }) => {
    test.setTimeout(120_000);
    await meetingsOrg(page);
    await page.goto("/meetings?date=2027-03-10");
    const toolbar = page.locator("[data-calendar-phone-toolbar]");
    const views = toolbar.getByRole("radiogroup");
    const v = (await views.boundingBox())!;
    expect(v.width).toBeGreaterThan(PHONE.width - 40);
    await expect(views.getByRole("radio")).toHaveText(["Month", "Day", "Agenda"]);
    for (const b of await toolbar.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await toolbar.getByRole("button", { name: /March 2027/ }).click();
    const picker = page.getByRole("dialog", { name: "Pick a month" });
    await picker.getByRole("button", { name: "June 2027" }).click();
    await expect(toolbar).toContainText("June 2027");

    // The sheet has the Calendars, My activities, Upcoming and Meetings by contact; the month view is the calendar.
    await page.getByTestId("app-top-bar").getByRole("button", { name: "Calendars" }).click();
    const calendars = page.getByRole("dialog", { name: "Calendars" });
    await expect(calendars.getByTestId("meetings-upcoming")).toBeVisible();
    await expect(calendars.getByRole("grid")).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Agenda works as US-MTG-17 describes.
    await toolbar.getByRole("radio", { name: "Agenda view" }).click();
    await expect(toolbar.getByRole("radio", { name: "Agenda view" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("calendar-phone-month")).toHaveCount(0);

        // + on a day that isn't today: New meeting full screen on that day.
    await page.goto("/meetings?date=2027-03-10");
    await page.locator("[data-main-action]").getByRole("button", { name: "New meeting" }).click();
    const editor = page.getByRole("dialog").filter({ hasText: "New event" });
    await expect(editor).toHaveAttribute("data-phone-fullscreen", "");
    await expect(editor.getByLabel("Start")).toHaveValue("2027-03-10T09:00");
  });
});
