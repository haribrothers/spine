import { test, expect, logIn } from "./fixtures";

const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

test.describe("US-ONB-12", () => {
  test("Staff don't see the owner's \"Get started\" card", async ({ seededOrg, browser }) => {
    void seededOrg;
    const context = await browser.newContext();
    const page = await context.newPage();
    await logIn(page, DEMO_STAFF_USER);
    await expect(page.getByRole("button", { name: "Edit layout" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Get started", { exact: true })).toHaveCount(0);
    await context.close();
  });
});
