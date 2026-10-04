import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const STAFF_NAME = "Sarah Mendes";

const row = (page: Page, name: string) => page.getByTestId("user-row").filter({ hasText: name });

async function openPromote(page: Page) {
  await row(page, STAFF_NAME).getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Promote to Owner" }).click();
}

test.describe("US-TEAM-16 and US-TEAM-17", () => {
  test("promoting someone to Owner is confirmed first", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/team/users");
    await expect(row(page, STAFF_NAME)).toContainText("Staff");

    await openPromote(page);
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`Make ${STAFF_NAME} an owner?`);
    await expect(dialog).toContainText(
      `Owners have full access to everything in Riverstone Builders — every record and report, plus Users, Teams and Settings. Team permissions no longer apply to ${STAFF_NAME}. Any owner can change them back to Staff later.`,
    );
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(row(page, STAFF_NAME)).toContainText("Staff");

    await openPromote(page);
    const confirm = page.getByRole("alertdialog").getByRole("button", { name: "Make owner" });
    await expect(confirm).toHaveClass(/bg-primary/);
    await confirm.click();
    await expect(row(page, STAFF_NAME)).toContainText("Owner");

    // Put things back for the specs that rely on the demo Staff user.
    await row(page, STAFF_NAME).getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Demote to Staff" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Demote" }).click();
    await expect(row(page, STAFF_NAME)).toContainText("Staff");
  });

  test("the Primary Owner's row has no Deactivate and only the transfer in its menu", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/team/users");
    const primary = page.getByTestId("user-row").filter({ hasText: "Primary Owner" });
    await expect(primary.getByRole("button", { name: "Deactivate" })).toHaveCount(0);
    await primary.getByRole("button", { name: "More actions" }).click();
    const items = await page.getByRole("menuitem").allTextContents();
    expect(items).toEqual(["Transfer primary ownership…"]);
    await page.keyboard.press("Escape");

    await expect(page.getByText("Everyone with access to this organisation.")).toHaveCount(1);
  });
});
