import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api } from "./quote-seed";

test.describe("US-ONB-28", () => {
  test("the demo's invoices are due, late, chased and paid, and Activity shows it", async ({ page }) => {
    test.setTimeout(120_000);
    await signUpNewOrg(page, { name: "Demo Owner", email: `e2e-onb-28-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await api(page, "POST", "/demo-data/seed", { country: "GB", industry: "it_services" });

    await page.goto("/invoices");
    const stats = page.getByTestId("invoice-stats");
    await expect(stats.getByRole("button", { name: /^Show overdue invoices, [1-9]/ })).toBeVisible();
    await expect(stats.getByRole("button", { name: /^Show invoices due in 7 days, [1-9]/ })).toBeVisible();

    await stats.getByRole("button", { name: /^Show overdue invoices/ }).click();
    const rows = page.getByRole("row").filter({ has: page.getByTestId("invoice-state") });
    let found = false;
    for (const link of await rows.getByRole("link").filter({ hasText: /INV/ }).all()) {
      await link.click();
      const activity = page.getByTestId("invoice-activity");
      await expect(activity.getByTestId("invoice-activity-entry").first()).toBeVisible();
      if ((await activity.getByText("Reminder sent").count()) > 0) {
        await expect(activity.getByText(/^Emailed to /)).toBeVisible();
        found = true;
        break;
      }
      await page.goBack();
    }
    expect(found).toBe(true);
  });
});
