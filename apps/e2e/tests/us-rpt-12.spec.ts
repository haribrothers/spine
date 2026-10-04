import { test, expect } from "./fixtures";

const MESSAGE = "Your books are out of balance by 12.34 USD. Contact the person who runs Spine.";

test.describe("US-RPT-12", () => {
  test("Owners see the out-of-balance warning on the dashboard, and nothing when the books balance", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/dashboard");
    await expect(page.getByText("Cash position")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("ledger-integrity-alert")).toHaveCount(0);

    // The books can't be unbalanced through the app, so the check's result is faked.
    await page.route("**/reports/ledger-integrity", (route) => route.fulfill({ json: { balanced: false, checkedAt: new Date().toISOString(), message: MESSAGE } }));
    await page.reload();
    await expect(page.getByTestId("ledger-integrity-alert")).toHaveText(MESSAGE);
  });
});
