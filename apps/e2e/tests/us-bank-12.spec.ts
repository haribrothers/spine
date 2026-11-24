import { test, expect, logIn } from "./fixtures";

const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

test.describe("US-BANK-12", () => {
  test("the Banking rights in the Team matrix, with reconciling implying viewing", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/team/teams");
    await page.getByRole("link", { name: /General Staff/ }).click();
    await page.getByRole("tab", { name: "Permissions" }).click();
    await page.getByRole("button", { name: "Banking" }).click();

    const view = page.getByRole("switch", { name: "View bank balances and registers" });
    const record = page.getByRole("switch", { name: "Record transfers and other money in or out" });
    const reconcile = page.getByRole("switch", { name: "Reconcile accounts" });
    for (const s of [view, record, reconcile]) await expect(s).not.toBeChecked();

    await reconcile.click();
    await expect(reconcile).toBeChecked();
    await expect(view).toBeChecked();
    await expect(page.getByTestId("privilege-notice")).toHaveText("“View bank balances and registers” turned on too. Reconciling needs to see the account.");

    await view.click();
    await expect(view).not.toBeChecked();
    await expect(reconcile).not.toBeChecked();
    await expect(page.getByTestId("privilege-notice")).toHaveText("“Reconcile accounts” turned off too. Reconciling needs to see the account.");
  });

  test("Staff without View bank balances get the no-access page, but payment forms still list accounts", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("about:blank");
    await page.context().clearCookies();
    await logIn(page, DEMO_STAFF_USER);
    await expect(page.getByRole("link", { name: "Banking" })).toHaveCount(0);
    await page.goto("/banking");
    await expect(page.getByTestId("no-access")).toContainText("You don't have access to Banking");

    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    await expect(page.getByRole("dialog").getByRole("combobox", { name: "Paid into" })).toHaveText("Bank Account");
  });
});
