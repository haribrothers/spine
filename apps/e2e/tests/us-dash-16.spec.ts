import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-DASH-16", () => {
  test("Today lists follow-ups due today and the next meeting in time order, and opens the calendar on today", async ({ page, seededOrg: _ }) => {
    const contacts = (await (await page.request.get(`${API_URL}/contacts`)).json()) as { id: string; name: string }[];
    const contact = contacts[0]!;
    const res = await page.request.post(`${API_URL}/activities`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { contactId: contact.id, type: "call", notes: "Call back Priya Nair", dueAt: new Date().toISOString() },
    });
    expect(res.ok()).toBe(true);

    await page.goto("/dashboard");
    const card = page.getByTestId("today-card");
    await expect(card.getByRole("heading", { name: "Today" })).toBeVisible({ timeout: 15_000 });

    const followup = card.locator('li[data-kind="followup"]').filter({ hasText: "Call back Priya Nair" });
    await expect(followup).toContainText("Today");
    await expect(followup).toContainText(`Follow-up · ${contact.name}`);

    // The demo's soonest meeting is tomorrow: it shows as the next meeting, after today's entries.
    const meeting = card.locator('li[data-kind="meeting"]').filter({ hasText: "Weekly crew scheduling" });
    await expect(meeting).toContainText(/Tomorrow \d{1,2}:\d{2}/);
    await expect(meeting).toContainText("Meeting");
    const kinds = await card.locator("li[data-kind]").evaluateAll((items) => items.map((li) => li.textContent ?? ""));
    expect(kinds.findIndex((t) => t.includes("Call back Priya Nair"))).toBeLessThan(kinds.findIndex((t) => t.includes("Weekly crew scheduling")));

    await card.getByRole("link", { name: "Open calendar" }).click();
    await expect(page).toHaveURL(/\/meetings\?view=day/);
  });
});
