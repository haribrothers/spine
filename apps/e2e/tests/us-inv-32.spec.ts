import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, contact } from "./quote-seed";
import { invoice, issue, pay } from "./invoice-seed";

test.describe("US-INV-32", () => {
  test("Activity tells the invoice's story, newest first, and View history keeps the changes", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-inv-32-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const inv = await invoice(page, c.id, { issueDays: -30, dueDays: -2 });
    await issue(page, inv.id);
    await api(page, "POST", `/invoices/${inv.id}/send-reminder`, {});
    await pay(page, c.id, inv.id, "25000");

    await page.goto(`/invoices/${inv.id}`);
    const activity = page.getByTestId("invoice-activity");
    const entries = activity.getByTestId("invoice-activity-entry");
    await expect(entries.first()).toContainText("Payment recorded");
    await expect(entries.first()).toContainText("Bank transfer");
    await expect(activity).toContainText("Reminder sent");
    await expect(activity).toContainText("Issued");
    await expect(entries.last()).toContainText("Created");
    await expect(activity).toContainText("Priya Raman");
    await entries.first().getByRole("link").click();
    await expect(page).toHaveURL(/\/payments\?id=/);

    await page.goBack();
    await page.getByTestId("invoice-activity").getByRole("button", { name: "View history" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
