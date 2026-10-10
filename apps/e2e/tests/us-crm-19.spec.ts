import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

async function openStages(page: Page) {
  await page.getByRole("button", { name: /E2E Seeded Owner/ }).last().click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("settings-sections").getByRole("button", { name: "Pipeline stages" }).click();
  return dialog.getByTestId("settings-pane");
}

test.describe("US-CRM-19", () => {
  test("an Owner renames, adds and reorders stages; the board follows and keeps its leads; Won and Lost are locked; 12 is the limit", async ({ page, seededOrg: _ }) => {
    const pane = await openStages(page);
    await expect(
      pane.getByText("The columns on your pipeline board. Rename, reorder or add stages. Won and Lost always stay last so reports can tell a closed lead from an open one."),
    ).toBeVisible();
    await expect(pane.getByLabel("Can't be moved or deleted")).toHaveCount(2);

    await pane.locator('input[value="Proposal"]').fill("Quote sent");
    await pane.getByRole("button", { name: "+ Add stage" }).click();
    await pane.locator('input[value="New stage"]').fill("Site visit booked");
    // Keyboard-friendly reorder: the new stage moves up above "Quote sent".
    await pane.getByRole("button", { name: "Move Site visit booked up" }).click();
    await pane.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved").first()).toBeVisible();

    await page.goto("/leads");
    // US-CRM-24: Won and Lost are slim columns at the end (no heading), so read each column's stage name.
    const stageNames = () => page.locator("[data-stage]").evaluateAll((els) => els.map((el) => el.getAttribute("data-stage")));
    await expect.poll(stageNames).toEqual(["New", "Qualified", "Site visit booked", "Quote sent", "Won", "Lost"]);
    // The renamed column keeps the three demo leads that were in "Proposal"; the new one starts empty.
    const count = (title: string) => page.locator("h3", { hasText: title }).locator("xpath=following-sibling::span[1]");
    await expect(count("Quote sent")).toHaveText("3");
    await expect(count("Site visit booked")).toHaveText("0");

    const again = await openStages(page);
    for (let i = 0; i < 6; i++) await again.getByRole("button", { name: "+ Add stage" }).click();
    await expect(again.getByRole("button", { name: "+ Add stage" })).toBeDisabled();
    await expect(again.getByText("Up to 12 stages.", { exact: true })).toBeVisible();
  });
});
