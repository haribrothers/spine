import { test, expect } from "@playwright/test";
import { card, pipelineOrg } from "./pipeline-helpers";

test.describe("US-CRM-28", () => {
  test("owner and source filters combine, live in the address, and come back with Back and reload", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await pipelineOrg(page);
    await org.addLead("Villa extension", { source: "Referral", ownerUserId: org.me });
    await org.addLead("Office block", { source: "Website", ownerUserId: org.me });
    await org.addLead("Warehouse", { source: "Referral" });
    await page.goto("/leads");
    await expect(card(page, "Warehouse")).toBeVisible();

    await page.getByRole("combobox", { name: "Filter by owner" }).click();
    for (const option of ["All owners", "My leads", "Priya Raman", "Unassigned"]) await expect(page.getByRole("option", { name: option })).toBeVisible();
    await page.getByRole("option", { name: "My leads" }).click();
    await page.getByRole("combobox", { name: "Filter by source" }).click();
    await page.getByRole("option", { name: "Referral" }).click();
    await expect(page).toHaveURL(/\/leads\?owner=me&source=Referral$/);
    await expect(card(page, "Villa extension")).toBeVisible();
    await expect(card(page, "Office block")).toHaveCount(0);
    await expect(card(page, "Warehouse")).toHaveCount(0);

    await page.getByRole("textbox", { name: "Search leads or contacts" }).fill("nothing like this");
    await expect(page.getByText("No leads match these filters")).toBeVisible();
    await page.getByRole("textbox", { name: "Search leads or contacts" }).fill("");

    await page.reload();
    await expect(page.getByRole("combobox", { name: "Filter by owner" })).toHaveText("My leads");
    await expect(page.getByRole("combobox", { name: "Filter by source" })).toHaveText("Referral");
    await expect(card(page, "Office block")).toHaveCount(0);

    // Away and Back returns to the same board.
    await page.goto("/contacts");
    await page.goBack();
    await expect(page).toHaveURL(/\/leads\?owner=me&source=Referral$/);
    await expect(card(page, "Villa extension")).toBeVisible();
    await expect(card(page, "Warehouse")).toHaveCount(0);

    await page.getByRole("combobox", { name: "Filter by owner" }).click();
    await page.getByRole("option", { name: "Unassigned" }).click();
    await expect(page).toHaveURL(/owner=unassigned/);
    await expect(card(page, "Warehouse")).toBeVisible();
  });

  test("Refresh reloads the board in place; it also refreshes after 30 seconds away", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await pipelineOrg(page);
    await org.addLead("Villa extension");
    await page.goto("/leads");
    await expect(page.getByTestId("pipeline-updated")).toHaveText("Updated just now");

    await org.addLead("Added elsewhere");
    await expect(card(page, "Added elsewhere")).toHaveCount(0);
    await page.getByRole("button", { name: "Refresh pipeline" }).click();
    await expect(card(page, "Added elsewhere")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Pipeline updated" })).toHaveCount(1);

    await org.addLead("Back on the tab");
    await page.evaluate(() => {
      const doc = (globalThis as unknown as { document: { dispatchEvent(e: unknown): void } }).document;
      Object.defineProperty(doc, "visibilityState", { configurable: true, get: () => "hidden" });
      doc.dispatchEvent(new Event("visibilitychange"));
      const realNow = Date.now;
      Date.now = () => realNow() + 31_000;
      Object.defineProperty(doc, "visibilityState", { configurable: true, get: () => "visible" });
      doc.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(card(page, "Back on the tab")).toBeVisible();
  });
});
