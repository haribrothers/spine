import { test, expect } from "@playwright/test";
import { card, column, moveVia, pipelineOrg } from "./pipeline-helpers";

test.describe("US-CRM-27", () => {
  test("one drawer for a lead: details with owner and expected close, follow-ups, quotes and history", async ({ page }) => {
    test.setTimeout(150_000);
    const org = await pipelineOrg(page);
    await org.addLead("Ground-floor extension", { value: "1140000", source: "Website" });
    await page.goto("/leads");
    await moveVia(page, "Ground-floor extension", "Qualified");
    await expect(column(page, "Qualified").locator("[data-lead]")).toHaveCount(1);

    await card(page, "Ground-floor extension").getByRole("button", { name: /^Ground-floor extension/ }).click();
    const drawer = page.getByTestId("lead-drawer");
    await expect(drawer.getByRole("heading", { name: "Ground-floor extension" })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Ananya Rao" })).toHaveAttribute("href", `/contacts/${org.contacts.ananya}`);
    await expect(drawer).toContainText("created by Priya Raman");
    for (const label of ["Title", "Contact", "Stage", "Estimated value", "Currency", "Owner", "Expected close", "Source"]) await expect(drawer.getByText(label, { exact: true }).first()).toBeVisible();

    // Owner: any active member or Unassigned; expected close date.
    await drawer.getByRole("combobox", { name: "Owner" }).click();
    await expect(page.getByRole("option", { name: "Unassigned" })).toBeVisible();
    await page.getByRole("option", { name: "Priya Raman" }).click();
    await drawer.getByLabel("Expected close").fill("2026-10-30");

    // History: created, then the stage change, with who.
    const history = drawer.getByTestId("lead-history");
    await expect(history.getByRole("listitem")).toHaveCount(2);
    await expect(history.getByRole("listitem").first()).toContainText("Moved to Qualified from New");
    await expect(history.getByRole("listitem").first()).toContainText("Priya Raman");
    await expect(history.getByRole("listitem").last()).toContainText("Created in New");

    // Follow-ups: add one for this lead, then tick it done.
    await drawer.getByRole("button", { name: "Add follow-up" }).click();
    const dialog = page.getByRole("dialog", { name: "Add follow-up" });
    await expect(dialog.getByRole("button", { name: "Add follow-up" })).toBeDisabled();
    await dialog.getByLabel("Notes").fill("Site visit with the structural engineer");
    await dialog.getByLabel("Follow-up date").fill("2030-01-15");
    await dialog.getByRole("button", { name: "Add follow-up" }).click();
    const followUps = drawer.getByRole("region", { name: "Follow-ups" });
    await expect(followUps.getByText("Site visit with the structural engineer")).toBeVisible();
    await followUps.getByRole("checkbox").first().click();
    await expect(followUps.getByRole("checkbox").first()).toBeChecked();

    await expect(drawer.getByRole("region", { name: "Quotes" })).toContainText("No quotes for this lead yet.");

    await drawer.getByRole("button", { name: "Save changes" }).click();
    await expect(drawer).toHaveCount(0);
    await expect(card(page, "Ground-floor extension").getByTestId("lead-owner")).toHaveText("PR");
    await page.reload();
    await card(page, "Ground-floor extension").getByRole("button", { name: /^Ground-floor extension/ }).click();
    await expect(page.getByTestId("lead-drawer").getByLabel("Expected close")).toHaveValue("2026-10-30");
  });

  test("Add lead from a column opens the drawer at that stage, with just the details", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await pipelineOrg(page);
    await org.addLead("Villa extension");
    await page.goto("/leads");
    await column(page, "Proposal").getByRole("button", { name: "Add lead" }).click();
    const drawer = page.getByTestId("lead-drawer");
    await expect(drawer.getByRole("heading", { name: "Add lead" })).toBeVisible();
    await expect(drawer.getByRole("combobox", { name: "Stage" })).toHaveText("Proposal");
    await expect(drawer.getByRole("region", { name: "Follow-ups" })).toHaveCount(0);
    await expect(drawer.getByRole("region", { name: "History" })).toHaveCount(0);

    await drawer.getByRole("combobox", { name: "Contact" }).click();
    await page.getByRole("option", { name: "Ananya Rao" }).click();
    await drawer.getByLabel("Title").fill("Rooftop terrace");
    await drawer.getByRole("button", { name: "Add lead" }).click();
    await expect(column(page, "Proposal").locator("[data-lead]")).toHaveText([/Rooftop terrace/]);
  });
});
