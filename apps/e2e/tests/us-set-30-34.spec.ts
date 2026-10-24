import { expectNoAxeViolations } from "./axe";
import { test, expect, logIn } from "./fixtures";

const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

test.describe("US-SET-30 to US-SET-34", () => {
  test("an Owner's Settings: grouped, in the address, guarding unsaved changes and searchable by content", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /E2E Seeded Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();

    // US-SET-30/33: opens on Business profile for an Owner, and says so in the address.
    await expect(page).toHaveURL(/settings=business/);
    const dialog = page.getByTestId("settings-dialog");
    const list = dialog.getByTestId("settings-sections");
    // US-SET-31: the groups, in order, with Team links.
    for (const group of ["Your account", "Business", "Money & tax", "Documents & emails", "Sales & meetings", "Data", "Team"]) await expect(list.getByText(group, { exact: true })).toBeVisible();
    await expect(list.getByRole("button", { name: "Profile", exact: true })).toBeVisible();
    await expectNoAxeViolations(page);

    // US-SET-33: the pane is kept in the address, through a reload.
    await list.getByRole("button", { name: "Numbering" }).click();
    await expect(page).toHaveURL(/settings=numbering/);
    await page.reload();
    await expect(page.getByTestId("settings-pane")).toContainText("Document numbering");

    // Unsaved changes ask before they're dropped; Keep editing keeps them.
    const prefix = page.getByTestId("settings-pane").locator("input").first();
    await prefix.fill("ZZ-");
    await expect(page.getByTestId("settings-unsaved-dot")).toBeVisible();
    await page.getByTestId("settings-sections").getByRole("button", { name: "Branding" }).click();
    const guard = page.getByRole("alertdialog", { name: "Discard unsaved changes to Numbering?" });
    await guard.getByRole("button", { name: "Keep editing" }).click();
    await expect(page).toHaveURL(/settings=numbering/);
    await expect(prefix).toHaveValue("ZZ-");
    await page.keyboard.press("Escape");
    await page.getByRole("alertdialog", { name: "Discard unsaved changes to Numbering?" }).getByRole("button", { name: "Discard" }).click();
    await expect(page.getByTestId("settings-dialog")).toHaveCount(0);
    await expect(page).not.toHaveURL(/settings=/);

    // US-SET-34: search finds a pane by what it contains; Enter opens it.
    await page.goto("/dashboard?settings=business");
    const search = page.getByRole("textbox", { name: "Search settings" });
    await search.fill("prefix");
    await expect(page.getByTestId("settings-sections").getByRole("button", { name: /Numbering/ })).toContainText("Matches: invoice prefix");
    await search.press("Enter");
    await expect(page).toHaveURL(/settings=numbering/);
    await search.fill("zzzz");
    await expect(page.getByTestId("settings-sections")).toContainText("No matching settings.");
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search).toHaveValue("");

    // A Team link closes Settings and opens the page.
    await page.getByTestId("settings-sections").getByRole("button", { name: "Users" }).click();
    await page.waitForURL("**/team/users");
    await expect(page.getByTestId("settings-dialog")).toHaveCount(0);
  });

  test("US-SET-32: roomy on a big screen, the list then the pane on a phone", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.setViewportSize({ width: 1920, height: 1200 });
    await page.goto("/dashboard?settings=documents");
    const box = (await page.getByTestId("settings-dialog").boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(1152);
    expect(box.width).toBeGreaterThan(1100);
    expect(Math.round(box.height)).toBe(960);

    // US-SET-31: on a short window rows keep their height, and the open pane's row stays in view.
    await page.setViewportSize({ width: 1440, height: 640 });
    await page.goto("/dashboard?settings=numbering");
    const numbering = page.getByTestId("settings-sections").getByRole("button", { name: "Numbering" });
    await expect(numbering).toBeInViewport();
    expect(Math.round((await numbering.boundingBox())!.height)).toBe(30);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard?settings=business");
    const list = page.getByTestId("settings-sections");
    await expect(list).toBeVisible();
    await list.getByRole("button", { name: "Numbering" }).click();
    await expect(page.getByTestId("settings-pane")).toContainText("Document numbering");
    await expect(list).toBeHidden();
    await page.getByRole("button", { name: "Back to settings" }).click();
    await expect(list).toBeVisible();
  });

  test("US-SET-30: Staff open Settings with their own account only; /profile opens it", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("about:blank");
    await page.context().clearCookies();
    await logIn(page, DEMO_STAFF_USER);
    await page.getByRole("button", { name: /Sarah Mendes/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await expect(page).toHaveURL(/settings=profile/);
    const list = page.getByTestId("settings-sections");
    await expect(list.getByRole("button")).toHaveText(["Profile", "Password & security", "Notifications", "About Spine"]);
    await expect(list.getByText("Business", { exact: true })).toHaveCount(0);
    // Asking for a business pane opens their first pane instead.
    await page.goto("/dashboard?settings=numbering");
    await expect(page).toHaveURL(/settings=profile/);
    await page.goto("/profile?tab=password");
    await expect(page).toHaveURL(/settings=security/);
    await expect(page.getByTestId("account-security")).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
