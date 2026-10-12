import type { Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { test, expect } from "./fixtures";

const toasts = (page: Page) => page.locator('[data-testid="toast"]');
const teamRow = (page: Page, name: string) => page.getByTestId("teams-table").getByRole("row").filter({ hasText: name });

/**
 * Uses the demo's Teams (General Staff, default; Accounts, with Neha Kapoor)
 * and puts everything back, since the seeded organisation is shared.
 */
test.describe("US-TEAM-25 to US-TEAM-29", () => {
  test("the list, and a duplicate created, checked and deleted", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/team/teams");

    // US-TEAM-25 — cards, rows that say what each Team adds up to, search in the address.
    const cards = page.getByTestId("teams-cards");
    await expect(cards).toContainText("Staff on no Team");
    await expect(cards).toContainText("Kavya Iyer · open in Users");
    await expect(teamRow(page, "General Staff")).toContainText("Default");
    await expect(teamRow(page, "Accounts")).toContainText("Demo");
    await expect(teamRow(page, "Accounts")).toContainText(/\d+ of \d+ sections/);
    await expect(page.getByTestId("teams-table").getByRole("columnheader", { name: /Works in/ })).toBeVisible();
    await expect(teamRow(page, "Accounts")).toContainText("1 person");
    await page.getByRole("searchbox", { name: "Search Teams" }).fill("the books");
    await expect(page).toHaveURL(/q=the(\+|%20)books/);
    // Accounts' description, from the demo: a header row and one Team.
    await expect(page.getByTestId("teams-table").getByRole("row")).toHaveCount(2);
    await page.getByRole("searchbox", { name: "Search Teams" }).fill("");
    await expectNoAxeViolations(page);

    // The default Team's menu has no Delete.
    await teamRow(page, "General Staff").getByRole("button", { name: "Actions for General Staff" }).click();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // US-TEAM-26 — Duplicate starts from Accounts' permissions and opens the copy's Permissions.
    await teamRow(page, "Accounts").getByRole("button", { name: "Actions for Accounts" }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    const dialog = page.getByRole("dialog", { name: "Duplicate Accounts" });
    await expect(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("Accounts (copy)");
    await dialog.getByRole("button", { name: "Create Team" }).click();
    await expect(toasts(page).filter({ hasText: "Accounts (copy) created" })).toBeVisible();
    await page.waitForURL(/\/team\/teams\/[0-9a-f-]{36}\?tab=permissions/);
    await expect(page.getByRole("tab", { name: "Permissions" })).toHaveAttribute("aria-selected", "true");
    const panel = page.getByTestId("members-will-open");
    await expect(panel.getByRole("listitem").filter({ hasText: "Banking" })).toContainText("can work here");
    // Reading quotes needs no permission, but Accounts allows nothing there.
    await expect(panel.getByRole("listitem").filter({ hasText: "Quotes" })).toContainText("view only");

    // A taken name is refused under the field.
    await page.goto("/team/teams");
    await page.getByRole("button", { name: "Create Team" }).click();
    const create = page.getByRole("dialog", { name: "Create Team" });
    await create.getByRole("textbox", { name: "Name" }).fill("accounts (COPY)");
    await create.getByRole("button", { name: "Create Team" }).click();
    await expect(create).toContainText("There's already a Team called accounts (COPY).");
    await page.keyboard.press("Escape");

    // US-TEAM-25 — Delete asks first, then toasts.
    await teamRow(page, "Accounts (copy)").getByRole("button", { name: "Actions for Accounts (copy)" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const ask = page.getByRole("alertdialog", { name: "Delete Accounts (copy)?" });
    await expect(ask).toContainText("No one is on it.");
    await ask.getByRole("button", { name: "Delete Team" }).click();
    await expect(toasts(page).filter({ hasText: "Accounts (copy) deleted" })).toBeVisible();
    await expect(teamRow(page, "Accounts (copy)")).toHaveCount(0);
  });

  test("members added and removed safely, permissions saved after review, and the history of both", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/team/teams");
    await page.getByRole("link", { name: "Accounts", exact: true }).click();
    await page.waitForURL(/\/team\/teams\/[0-9a-f-]{36}$/);

    // US-TEAM-27 — members with their other Teams; add several; remove asks first and warns.
    const membersTable = page.getByTestId("team-members-table");
    await expect(membersTable.getByRole("row").filter({ hasText: "Neha Kapoor" })).toContainText("General Staff");
    await page.getByRole("button", { name: "Add people" }).click();
    const add = page.getByRole("dialog", { name: "Add people to Accounts" });
    await expect(add.getByRole("group", { name: "Staff to add" })).toContainText("No Team");
    await add.getByRole("checkbox", { name: "Kavya Iyer" }).click();
    await add.getByRole("button", { name: "Add 1 person" }).click();
    await expect(toasts(page).filter({ hasText: "Added Kavya Iyer to Accounts" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Members, 2" })).toBeVisible();

    await membersTable.getByRole("button", { name: "Actions for Kavya Iyer" }).click();
    await page.getByRole("menuitem", { name: "Remove from Accounts" }).click();
    const remove = page.getByRole("alertdialog", { name: "Remove Kavya Iyer from Accounts?" });
    await expect(remove.getByTestId("remove-only-team")).toContainText("Kavya will be on no Team");
    await remove.getByRole("button", { name: "Remove" }).click();
    await expect(toasts(page).filter({ hasText: "Kavya Iyer removed from Accounts" })).toBeVisible();

    // US-TEAM-28 — a draft, reviewed, then saved.
    await page.getByRole("tab", { name: "Permissions" }).click();
    await expect(page).toHaveURL(/tab=permissions/);
    await page.getByRole("button", { name: "Manage Catalogue" }).click();
    const record = page.getByRole("switch", { name: "Create/edit own catalogue" });
    await expect(record).not.toBeChecked();
    await record.click();
    await expect(record).toBeChecked();
    await expect(page.getByTestId("permissions-bar")).toContainText("1 change");
    await expectNoAxeViolations(page);

    // Leaving with the draft asks first; staying keeps it.
    await page.getByRole("tab", { name: "History" }).click();
    const leave = page.getByRole("alertdialog", { name: "Discard 1 unsaved change?" });
    await leave.getByRole("button", { name: "Keep editing" }).click();
    await expect(page.getByTestId("permissions-bar")).toBeVisible();

    await page.getByTestId("permissions-bar").getByRole("button", { name: "Save changes" }).click();
    const save = page.getByRole("alertdialog", { name: "Save 1 change to Accounts?" });
    await expect(save.getByTestId("save-permissions-list")).toContainText("Turn on Create/edit own catalogue");
    await save.getByRole("button", { name: "Save changes" }).click();
    await expect(toasts(page).filter({ hasText: "Accounts saved" })).toContainText("Neha Kapoor gets them at their next request");
    await expect(page.getByTestId("permissions-bar")).toHaveCount(0);

    // US-TEAM-29 — the History tab tells it newest first.
    await page.getByRole("tab", { name: "History" }).click();
    const history = page.getByTestId("team-history");
    await expect(history.getByRole("listitem").first()).toContainText("turned on Create/edit own catalogue");
    await expect(history).toContainText("removed Kavya Iyer");
    await expect(history).toContainText("added Kavya Iyer");
    await page.getByRole("link", { name: "Open in audit log →" }).click();
    await expect(page.getByTestId("audit-one-record")).toBeVisible();

    // Put the permission back for the other specs.
    await page.goBack();
    await page.getByRole("tab", { name: "Permissions" }).click();
    await page.getByRole("button", { name: "Manage Catalogue" }).click();
    await page.getByRole("switch", { name: "Create/edit own catalogue" }).click();
    await page.getByTestId("permissions-bar").getByRole("button", { name: "Save changes" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("permissions-bar")).toHaveCount(0);
  });
});
