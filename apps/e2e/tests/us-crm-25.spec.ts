import { test, expect } from "@playwright/test";
import { api, card, column, moveVia, pipelineOrg } from "./pipeline-helpers";

// Cold-lead nudges (14 days with no activity) need time to pass; they're covered by the US-CRM-25 unit tests.
// Native drag and drop can't be driven in Playwright (see dashboard.spec.ts); a drop calls the same move as the menu.
test.describe("US-CRM-25", () => {
  test("a card shows owner, days in stage and the next follow-up; the menu moves it and says so", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await pipelineOrg(page);
    const villa = await org.addLead("Villa extension", { ownerUserId: org.me, value: "1260000" });
    const office = await org.addLead("Office block", { contactId: org.contacts.halcyon });
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    await api(page, "POST", "/activities", { leadId: villa.id, contactId: org.contacts.ananya, type: "call", dueAt: tomorrow.toISOString() });
    await api(page, "POST", "/activities", { leadId: office.id, contactId: org.contacts.halcyon, type: "meeting", dueAt: new Date(Date.now() - 86_400_000).toISOString() });
    // A lead with no title shows its contact's name once.
    await api(page, "POST", "/leads", { contactId: org.contacts.halcyon, valueCurrency: "INR", stageId: org.stage("Qualified").id });

    await page.goto("/leads");
    const villaCard = card(page, "Villa extension");
    await expect(villaCard).toContainText("Ananya Rao");
    await expect(villaCard).toContainText("₹12,600.00");
    await expect(villaCard).toContainText("0 days in stage");
    await expect(villaCard.getByTestId("lead-owner")).toHaveText("PR");
    await villaCard.getByTestId("lead-owner").hover();
    await expect(page.getByRole("tooltip", { name: "Priya Raman" })).toBeVisible();
    await expect(villaCard.getByTestId("lead-follow-up")).toHaveText("Call · Tomorrow 10:00");

    const officeCard = card(page, "Office block");
    await expect(officeCard.getByTestId("lead-owner")).toHaveText("—");
    await expect(officeCard.getByTestId("lead-follow-up")).toContainText("Meeting · Overdue");
    await expect(officeCard.getByTestId("lead-follow-up")).toHaveClass(/text-overdue/);
    await expect(column(page, "Qualified").locator("[data-lead]")).toHaveCount(1);
    await expect(column(page, "Qualified").getByText("Halcyon Tech Parks Pvt Ltd")).toHaveCount(1);

    // "⋯" → Move to… → Proposal: counts and totals follow, and it's announced.
    await moveVia(page, "Villa extension", "Proposal");
    await expect(column(page, "Proposal").locator("[data-lead]")).toHaveCount(1);
    await expect(column(page, "Proposal").getByText("₹12,600.00").first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Moved to Proposal" })).toHaveCount(1);
    await page.reload();
    await expect(column(page, "Proposal").locator("[data-lead]")).toHaveText([/Villa extension/]);
  });

  test("by keyboard: Tab to a card, Enter opens the drawer, the menu key opens its menu", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await pipelineOrg(page);
    await org.addLead("School block extension");
    await page.goto("/leads");
    const open = card(page, "School block extension").getByRole("button", { name: /^School block extension, Ananya Rao/ });
    await open.focus();
    await expect(open).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("lead-drawer")).toBeVisible();
    await expect(page.getByRole("heading", { name: "School block extension" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("lead-drawer")).toHaveCount(0);

    await open.focus();
    await page.keyboard.press("Shift+F10");
    await expect(page.getByRole("menuitem", { name: "Open" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Move to…" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Delete from the menu asks first.
    await card(page, "School block extension").getByRole("button", { name: "Actions for School block extension" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete lead" }).click();
    await expect(card(page, "School block extension")).toHaveCount(0);
  });
});
