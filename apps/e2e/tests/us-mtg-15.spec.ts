import { test, expect } from "@playwright/test";
import { dayParam, local, meetingsOrg } from "./meetings-helpers";

test.describe("US-MTG-15", () => {
  test("Upcoming says when, and opens the meeting; Meetings by contact counts the range on screen and links to the contact", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await meetingsOrg(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/meetings");
    const upcoming = page.getByTestId("meetings-upcoming");
    await expect(upcoming).toContainText("Nothing in the next 60 days.");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 9, 0);
    await org.addMeeting("Client walkthrough", start, new Date(start.getTime() + 60 * 60_000), { contactId: org.contactId, location: "12 Lavelle Road" });
    await org.addMeeting("Slab pour review", local(2027, 3, 10, 9), local(2027, 3, 10, 10), { contactId: org.contactId });
    await org.addMeeting("Design review", local(2027, 3, 11, 9), local(2027, 3, 11, 10), { contactId: org.contactId });

    await page.reload();
    await expect(upcoming.getByRole("button", { name: /^Client walkthrough/ })).toContainText("Tomorrow · 9:00 AM");
    await upcoming.getByRole("button", { name: /^Client walkthrough/ }).click();
    await expect(page).toHaveURL(new RegExp(`date=${dayParam(start)}`));
    const pop = page.getByRole("dialog").filter({ hasText: "Client walkthrough" });
    await expect(pop).toBeVisible();
    await expect(pop).toContainText("12 Lavelle Road");
    await page.keyboard.press("Escape");

    // The week of 7 March 2027 has two meetings with the contact.
    await page.goto("/meetings?view=week&date=2027-03-10");
    const byContact = page.getByTestId("meetings-by-contact");
    await expect(byContact).toContainText("Week of 7 Mar");
    const link = byContact.getByRole("link", { name: "Halcyon Tech Parks Pvt Ltd" });
    await expect(link).toHaveAttribute("href", `/contacts/${org.contactId}`);
    await expect(byContact.getByRole("listitem")).toContainText("2");
    // A week with none says so.
    await page.goto("/meetings?view=week&date=2027-05-12");
    await expect(byContact).toContainText("No meetings linked to a contact in this range.");
  });
});
