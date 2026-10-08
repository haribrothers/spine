import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg } from "./helpers";

async function openModules(page: Page) {
  await page.getByRole("button", { name: /Owner/ }).last().click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("settings-sections").getByRole("button", { name: "Modules" }).click();
  return dialog.getByTestId("settings-pane");
}

test.describe("US-SET-23", () => {
  test("an Owner switches a module off after a confirmation that says nothing is deleted", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-set-23-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const pane = await openModules(page);
    await expect(pane).toContainText("Switch off what your business doesn't use. Everyone sees a simpler Spine; nothing is deleted.");
    const list = pane.getByTestId("modules-list");
    for (const [name, description] of [
      ["Leads & meetings", "Pipeline board, lead stages, the meetings calendar and their dashboard widgets."],
      ["Jobs & field", "Jobs, milestones, retention, variation orders, job costing, crew and the field app."],
      ["Approvals", "Expense approval and quote discount approval. Off: expenses post when submitted and discounts need no approval."],
      ["Recurring documents", "Recurring invoices and recurring bills."],
    ]) {
      await expect(list.getByRole("switch", { name: name })).toBeChecked();
      await expect(list).toContainText(description!);
    }
    await expect(pane).toContainText("Contacts, quotes, invoices, payments, purchases, banking, tax and reports are always on.");
    await expectNoAxeViolations(page);

    await list.getByRole("switch", { name: "Approvals" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByRole("heading", { name: "Switch off approvals?" })).toBeVisible();
    await expect(confirm).toContainText("Expense approval and quote discount approval disappear for everyone.");
    await expect(confirm).toContainText("Nothing is deleted. Switch it back on any time and everything is where you left it.");
    await confirm.getByRole("button", { name: "Switch off" }).click();
    await expect(list.getByRole("switch", { name: "Approvals" })).not.toBeChecked();
    await pane.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Your changes have been saved.").first()).toBeVisible();

    // "Keep it on" leaves the switch alone.
    await list.getByRole("switch", { name: "Recurring documents" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Keep it on" }).click();
    await expect(list.getByRole("switch", { name: "Recurring documents" })).toBeChecked();
  });
});
