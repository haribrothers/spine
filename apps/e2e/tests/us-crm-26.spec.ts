import { test, expect } from "@playwright/test";
import { card, column, moveVia, pipelineOrg } from "./pipeline-helpers";

test.describe("US-CRM-26", () => {
  test("moving to Lost asks why; the reason shows on the card and in the drawer, and is cleared when the lead moves back", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await pipelineOrg(page);
    await org.addLead("Warehouse mezzanine", { contactId: org.contacts.halcyon, stage: "Proposal" });
    await org.addLead("Retail fit-out", { contactId: org.contacts.halcyon, stage: "Proposal" });
    await page.goto("/leads");

    await moveVia(page, "Warehouse mezzanine", "Lost");
    const dialog = page.getByRole("dialog", { name: "Why was it lost?" });
    await expect(dialog).toBeVisible();
    for (const reason of ["Price", "Timing", "Went with a competitor", "No response", "Other"]) await expect(dialog.getByRole("button", { name: reason })).toBeVisible();
    await dialog.getByRole("button", { name: "Went with a competitor" }).click();
    await expect(dialog.getByRole("button", { name: "Went with a competitor" })).toHaveAttribute("aria-pressed", "true");
    await dialog.getByLabel("Note (optional)").fill("Lower bid from a local contractor.");
    await dialog.getByRole("button", { name: "Save reason" }).click();
    await expect(dialog).toHaveCount(0);

    await column(page, "Lost").getByRole("button", { name: /^Show Lost: 1 lead/ }).click();
    const lost = card(page, "Warehouse mezzanine");
    await expect(lost.getByTestId("lead-lost-reason")).toHaveText("Went with a competitor");
    await lost.getByRole("button", { name: /^Warehouse mezzanine/ }).click();
    const drawer = page.getByTestId("lead-drawer");
    await expect(drawer.getByTestId("lead-drawer-lost").getByRole("button", { name: "Went with a competitor" })).toHaveAttribute("aria-pressed", "true");
    await expect(drawer.getByLabel("Note (optional)")).toHaveValue("Lower bid from a local contractor.");
    await page.keyboard.press("Escape");

    // Back to an open stage clears it.
    await moveVia(page, "Warehouse mezzanine", "Qualified");
    await moveVia(page, "Warehouse mezzanine", "Lost");
    await expect(page.getByRole("dialog", { name: "Why was it lost?" }).getByRole("button", { name: "Went with a competitor" })).toHaveAttribute("aria-pressed", "false");
    // "Skip" leaves it lost with no reason.
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(card(page, "Warehouse mezzanine")).toBeVisible();
    await expect(card(page, "Warehouse mezzanine").getByTestId("lead-lost-reason")).toHaveCount(0);
  });

  test("a won lead offers a quote that opens with its contact and is linked to it; without the right to quote, no offer", async ({ page }) => {
    test.setTimeout(150_000);
    const org = await pipelineOrg(page);
    await org.addLead("Ground-floor extension", { stage: "Proposal", value: "1140000" });
    await org.addLead("Villa extension", { stage: "Proposal" });
    await page.goto("/leads");

    await moveVia(page, "Ground-floor extension", "Won");
    const won = page.getByRole("dialog", { name: "Won — Ground-floor extension" });
    await expect(won).toContainText("Start a quote for Ananya Rao?");
    await expect(won).toContainText("OwnerUnassigned");
    await won.getByRole("button", { name: "Create quote" }).click();
    await expect(page).toHaveURL(/\/quotes\/new\?leadId=/, { timeout: 30_000 });
    await expect(page.getByTestId("quote-lead")).toContainText("For lead Ground-floor extension");
    await expect(page.getByText("Ananya Rao").first()).toBeVisible();
    await page.getByPlaceholder("Item name").fill("Ground-floor extension works");
    await page.getByLabel("Unit price").first().fill("11400");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/, { timeout: 30_000 });

    // The lead's drawer lists the quote, which opens it.
    await page.goto("/leads");
    await column(page, "Won").getByRole("button", { name: /^Show Won/ }).click();
    await card(page, "Ground-floor extension").getByRole("button", { name: /^Ground-floor extension/ }).click();
    const quotes = page.getByTestId("lead-drawer").getByRole("region", { name: "Quotes" });
    await expect(quotes.getByRole("listitem")).toHaveCount(1);
    await expect(quotes.getByRole("listitem")).toContainText("Draft");
    await quotes.getByRole("link").click();
    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/);

    // Someone without the right to create quotes sees no offer (the API refuses them too).
    await page.route("**/org/members/me/capabilities", async (route) => {
      const res = await route.fetch();
      const caps = (await res.json()) as Record<string, boolean>;
      await route.fulfill({ response: res, json: { ...caps, "quotes.edit_own": false, "quotes.edit_others": false } });
    });
    await page.goto("/leads");
    await moveVia(page, "Villa extension", "Won");
    await expect(page.getByRole("status").filter({ hasText: "Moved to Won" })).toHaveCount(1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
