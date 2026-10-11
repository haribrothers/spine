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
    // Every frame from the click on, record the quick view's edges: it must never cross the window, not even
    // for the moment before its attendees load (it opens at its full height, with a placeholder row).
    await page.evaluate(`(() => {
      window.__edges = [];
      const start = performance.now();
      const frame = () => {
        const content = document.querySelector("[data-radix-popper-content-wrapper]")?.firstElementChild;
        if (content) {
          const r = content.getBoundingClientRect();
          window.__edges.push({ top: r.top, bottom: r.bottom, right: r.right });
        }
        if (performance.now() - start < 2000) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    })()`);
    await event.click();
    const pop = page.getByRole("dialog").filter({ hasText: "Late review" });
    await expect(pop.getByText("Priya Raman (organizer)")).toBeVisible();
    await page.waitForTimeout(300);
    const edges = await page.evaluate<{ top: number; bottom: number; right: number }[]>("window.__edges");
    expect(edges.length).toBeGreaterThan(0);
    expect(Math.min(...edges.map((e) => e.top))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...edges.map((e) => e.bottom))).toBeLessThanOrEqual(720);
    expect(Math.max(...edges.map((e) => e.right))).toBeLessThanOrEqual(1280);
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
