import { test, expect } from "@playwright/test";
import { local, meetingsOrg } from "./meetings-helpers";

test.describe("US-MTG-17", () => {
  test("the calendar fills the window; Agenda rows show place and contact", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await meetingsOrg(page);
    await org.addMeeting("Slab pour review", local(2027, 3, 10, 9), local(2027, 3, 10, 10), { contactId: org.contactId, location: "Outer Ring Road" });
    await org.addMeeting("Crew briefing", local(2027, 3, 11, 9), local(2027, 3, 11, 9, 30));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/meetings?view=agenda&date=2027-03-10");

    const calendar = page.getByTestId("meetings-calendar");
    await expect(calendar).toBeVisible();
    const box = (await calendar.boundingBox())!;
    expect(800 - (box.y + box.height)).toBeLessThan(40);
    const pageScrolls = await page.evaluate("(() => { const m = document.querySelector('main'); return m ? m.scrollHeight > m.clientHeight + 1 : false; })()");
    expect(pageScrolls).toBe(false);

    const row = page.getByRole("button", { name: /Slab pour review/ });
    await expect(row).toContainText("9:00 AM – 10:00 AM");
    await expect(row).toContainText("Outer Ring Road");
    await expect(row).toContainText("Halcyon Tech Parks Pvt Ltd");
    await expect(page.getByRole("button", { name: /Crew briefing/ })).toContainText("Internal");
    await row.click();
    await expect(page.getByRole("dialog").filter({ hasText: "Slab pour review" })).toBeVisible();
  });

  test("on a phone it opens in Agenda with no Week, and the mini calendar opens in a sheet", async ({ page }) => {
    test.setTimeout(120_000);
    await meetingsOrg(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/meetings");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("radio", { name: "Agenda view" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: "Week view" })).toHaveCount(0);
    const overflows = await page.evaluate("(() => { const c = document.querySelector('[data-testid=\"meetings-calendar\"]'); return c ? c.scrollWidth > c.clientWidth + 1 : true; })()");
    expect(overflows).toBe(false);

    // An address asking for Week shows Day.
    await page.goto("/meetings?view=week");
    await expect(page.getByRole("radio", { name: "Day view" })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Mini calendar" }).click();
    const sheet = page.getByRole("dialog", { name: "Mini calendar" });
    await expect(sheet.getByRole("grid")).toBeVisible();
    await expect(sheet.getByText("Calendars")).toBeVisible();
  });
});
