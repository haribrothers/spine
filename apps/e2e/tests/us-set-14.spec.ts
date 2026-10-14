import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-SET-14", () => {
  test("no Settings pane says 'Continue'; Industry template and Chart of accounts say 'Save'", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-set-14-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await page.getByRole("button", { name: /Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog");
    const sections = dialog.getByTestId("settings-sections").getByRole("button");
    const pane = dialog.getByTestId("settings-pane");

    await expect(sections.first()).toBeVisible();
    // US-SET-31: Team links open pages, not panes.
    const labels = (await sections.allInnerTexts()).filter((l) => !["Users", "Teams", "Audit log", "Email log"].includes(l.trim()));
    expect(labels.length).toBeGreaterThan(5);
    for (const label of labels) {
      await sections.filter({ hasText: label }).first().click();
      // Each pane shows its heading once it has loaded.
      await expect(pane.getByRole("heading").first()).toBeVisible();
      await expect(pane.getByRole("button", { name: "Continue", exact: true }), `"${label}" says Continue`).toHaveCount(0);
    }

    for (const label of ["Industry template", "Chart of accounts"]) {
      await sections.filter({ hasText: label }).first().click();
      await expect(pane.getByRole("button", { name: "Save", exact: true })).toBeVisible();
    }
  });
});
