import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { test, expect } from "./fixtures";

const toasts = (page: Page) => page.locator('[data-testid="toast"]');
const table = (page: Page) => page.getByTestId("users-table");
const row = (page: Page, name: string) => table(page).getByRole("row").filter({ hasText: name });

async function menu(page: Page, name: string, item: string) {
  await row(page, name).getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

/**
 * Uses the demo's people (Sarah Mendes, Staff on General Staff; Marcus Webb,
 * Field) and puts everything back, since the seeded organisation is shared.
 */
test.describe("US-TEAM-19 to US-TEAM-23", () => {
  test("the list layout, Teams and access, and changing someone between Field and Staff", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/team/users");

    // US-TEAM-19 — tabs, badges, Teams and the role filter, kept in the address.
    await expect(page.getByRole("tab", { name: "Active, 3" })).toHaveAttribute("aria-selected", "true");
    const me = table(page).getByRole("row").filter({ hasText: "Primary Owner" });
    await expect(me).toContainText("You");
    await expect(me).toContainText("Everything");
    await expect(row(page, "Sarah Mendes")).toContainText("Demo");
    await expect(row(page, "Sarah Mendes")).toContainText("General Staff");
    await expect(row(page, "Marcus Webb")).toContainText("Field access");
    await page.getByRole("combobox", { name: "Filter by role" }).click();
    await page.getByRole("option", { name: "Field" }).click();
    await expect(page).toHaveURL(/role=field/);
    await expect(table(page).getByRole("row")).toHaveCount(2);
    await page.getByRole("combobox", { name: "Filter by role" }).click();
    await page.getByRole("option", { name: "All roles" }).click();

    // US-TEAM-22 — Field to Staff asks first and which Teams; with none ticked they can't open anything.
    await menu(page, "Marcus Webb", "Change to Staff");
    const toStaff = page.getByRole("alertdialog", { name: "Change Marcus Webb to Staff?" });
    await expect(toStaff).toContainText("Marcus will have their Teams' access instead of Field access");
    await toStaff.getByRole("checkbox", { name: "General Staff" }).click();
    await toStaff.getByRole("button", { name: "Change to Staff" }).click();
    await expect(toasts(page).filter({ hasText: "Marcus Webb is Staff" })).toBeVisible();
    await expect(row(page, "Marcus Webb")).toContainText("No Team — can't open anything");

    // US-TEAM-19 — the Staff without a Team card filters to them.
    const card = page.getByRole("button", { name: "Show Staff without a Team only" });
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/card=no-team/);
    await expect(table(page).getByRole("row")).toHaveCount(2);
    await card.click();

    // US-TEAM-20 — Manage Teams, then what they can open.
    await menu(page, "Marcus Webb", "Manage Teams");
    const manage = page.getByRole("dialog", { name: "Manage Teams — Marcus Webb" });
    await manage.getByRole("checkbox", { name: "General Staff" }).click();
    await manage.getByRole("button", { name: "Save Teams" }).click();
    await expect(toasts(page).filter({ hasText: "Teams saved" })).toContainText("Marcus Webb is on General Staff");
    await expect(row(page, "Marcus Webb")).toContainText("General Staff");

    await menu(page, "Marcus Webb", "What they can open");
    const drawer = page.getByTestId("user-access-drawer");
    await expect(page.getByRole("dialog", { name: "What Marcus Webb can open" })).toContainText("Staff · on General Staff.");
    await expect(drawer.getByRole("listitem").filter({ hasText: "Contacts" })).toContainText("can open");
    await expect(drawer.getByTestId("access-groups")).toContainText("Banking");
    await expect(drawer.getByRole("link", { name: "Edit on General Staff →" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Back to Field: the confirm names the Teams they come off.
    await menu(page, "Marcus Webb", "Change to Field");
    const toField = page.getByRole("alertdialog", { name: "Change Marcus Webb to Field?" });
    await expect(toField).toContainText("They'll come off General Staff.");
    await toField.getByRole("button", { name: "Change to Field" }).click();
    await expect(toasts(page).filter({ hasText: "Marcus Webb is Field" })).toBeVisible();
    await expect(row(page, "Marcus Webb")).toContainText("Field access");
  });

  test("invite several people onto their Teams, copy a link, and cancel", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/team/users");
    const tag = randomUUID().slice(0, 8);
    const sam = `sam-${tag}@example.com`;
    const neha = `neha-${tag}@example.com`;

    // US-TEAM-21 — several emails; one that isn't an address holds the send.
    await page.getByRole("button", { name: "Invite people" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite people" });
    await dialog.getByRole("textbox", { name: "Emails" }).fill(`${sam}, ${neha}\nvikram@meridian`);
    await expect(dialog).toContainText("vikram@meridian isn't an email address — fix or remove it.");
    await expect(dialog.getByRole("button", { name: "Send invites (2)" })).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Emails" }).fill(`${sam}, ${neha}`);
    await expect(dialog.getByRole("checkbox", { name: "General Staff" })).toBeChecked();
    await dialog.getByRole("button", { name: "Send invites (2)" }).click();
    await expect(toasts(page).filter({ hasText: "2 invites sent" })).toBeVisible();
    await expect(dialog).toHaveCount(0);

    // Inviting the same address again says why it was skipped.
    await page.getByRole("button", { name: "Invite people" }).click();
    await dialog.getByRole("textbox", { name: "Emails" }).fill(sam);
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(dialog.getByTestId("invite-skipped")).toContainText(`${sam} — already invited — resend it instead`);
    await dialog.getByRole("button", { name: "Done" }).click();

    // The Invites tab: who invited, the Teams on joining, when it expires; Copy invite link.
    await page.getByRole("tab", { name: /^Invites/ }).click();
    await expect(page).toHaveURL(/tab=invites/);
    const invite = page.getByTestId("invites-table").getByRole("row").filter({ hasText: sam });
    await expect(invite).toContainText("General Staff");
    await expect(invite).toContainText("E2E Seeded Owner");
    await expect(invite).toContainText("Expires in 2 days");
    await invite.getByRole("button", { name: `Actions for the invite to ${sam}` }).click();
    await page.getByRole("menuitem", { name: "Copy invite link" }).click();
    await expect(toasts(page).filter({ hasText: "Invite link copied" })).toContainText(`Only ${sam} can use it, signed in with that address.`);
    expect(await page.evaluate<string>("navigator.clipboard.readText()")).toMatch(/\/accept-invite\//);

    // Cancel both (asks first).
    for (const email of [sam, neha]) {
      await page.getByTestId("invites-table").getByRole("button", { name: `Actions for the invite to ${email}` }).click();
      await page.getByRole("menuitem", { name: "Cancel invite" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Cancel invitation" }).click();
      await expect(toasts(page).filter({ hasText: "Invitation cancelled" }).last()).toContainText(email);
    }
  });

  test("your own row has no Deactivate; deactivating and reactivating ask first and say what happened", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/team/users");

    // US-TEAM-23 — no Deactivate on my row.
    const me = table(page).getByRole("row").filter({ hasText: "You" });
    await me.getByRole("button", { name: /^Actions for / }).click();
    await expect(page.getByRole("menuitem", { name: "Deactivate" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // The demo's people say they go with the demo data.
    await menu(page, "Marcus Webb", "Deactivate");
    const ask = page.getByRole("alertdialog", { name: "Deactivate Marcus Webb?" });
    await expect(ask).toContainText("They're demo data, so they go when the demo data is deleted.");
    await ask.getByRole("button", { name: "Deactivate" }).click();
    await expect(toasts(page).filter({ hasText: "Marcus Webb deactivated" })).toBeVisible();

    await page.getByRole("tab", { name: "Deactivated, 1" }).click();
    await expect(row(page, "Marcus Webb")).toContainText("Deactivated");
    await menu(page, "Marcus Webb", "Reactivate");
    const back = page.getByRole("alertdialog", { name: "Reactivate Marcus Webb?" });
    await expect(back).toContainText("They get their previous role (Field) and Teams back");
    await back.getByRole("button", { name: "Reactivate" }).click();
    await expect(toasts(page).filter({ hasText: "Marcus Webb reactivated" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Deactivated, 0" })).toBeVisible();
  });

  test("Users, the access drawer and Invite people pass axe in light and dark", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/team/users");
      await expect(row(page, "Sarah Mendes")).toContainText("General Staff");
      await expectNoAxeViolations(page);
      await menu(page, "Sarah Mendes", "What they can open");
      await expect(page.getByTestId("access-groups")).toBeVisible();
      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Invite people" }).click();
      await page.getByRole("dialog", { name: "Invite people" }).getByRole("textbox", { name: "Emails" }).fill("sam@example.com, bad@x");
      await expectNoAxeViolations(page);
      await page.keyboard.press("Escape");
    }
  });
});
