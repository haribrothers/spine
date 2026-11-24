import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";

const WITH_CATEGORIES = "Submit an expense for approval. Categories are managed from Expenses › Categories.";
const PLAIN = "Submit an expense for approval.";

test.describe("US-PUR-19", () => {
  test("an Owner manages categories from Expenses › Categories, not Settings", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/expenses");
    await expect(page.getByText(WITH_CATEGORIES).first()).toBeVisible();
    await page.getByRole("button", { name: "Submit expense" }).click();
    await expect(page.getByRole("dialog")).toContainText(WITH_CATEGORIES);
    await page.keyboard.press("Escape");

    await page.getByRole("navigation", { name: "Expenses sections" }).getByRole("link", { name: "Categories" }).click();
    await page.waitForURL("**/expenses/categories");
    await expect(page.getByRole("button", { name: /Add category/ })).toBeVisible();
    await expect(page.getByTestId("categories-table").getByText(/\d{4} [A-Z]/).first()).toBeVisible(); // a posting account

    await page.getByRole("button", { name: /E2E Seeded Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Business profile" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Purchases" })).toHaveCount(0);
  });

  test("a member who can't manage categories gets no tab and the no-access page", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("about:blank");
    await page.context().clearCookies();
    await logIn(page, DEMO_FIELD_USER);
    await page.goto("/expenses");
    await expect(page.getByText(PLAIN, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(WITH_CATEGORIES)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Categories" })).toHaveCount(0);

    await page.goto("/expenses/categories");
    await expect(page.getByTestId("no-access")).toContainText("You don't have access to Expense categories");
  });
});
