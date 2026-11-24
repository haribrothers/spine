import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { invoice, issue, pay } from "./invoice-seed";

test.describe("US-INV-27", () => {
  test("the cards show what's owed, overdue, due this week and paid this month, and filter the list", async ({ page }) => {
    await signUpNewOrg(page, { name: "Invoice Owner", email: `e2e-inv-27-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const late = await issue(page, (await invoice(page, c.id, { issueDays: -40, dueDays: -10, lines: [{ name: "Tiling", price: "50000" }] })).id);
    const soon = await issue(page, (await invoice(page, c.id, { issueDays: -25, dueDays: 3, lines: [{ name: "Plumbing", price: "30000" }] })).id);
    const later = await issue(page, (await invoice(page, c.id, { issueDays: -1, dueDays: 29, lines: [{ name: "Painting", price: "20000" }] })).id);
    await pay(page, c.id, later.id, "5000");
    await invoice(page, c.id, { lines: [{ name: "Draft work", price: "99900" }] });

    // Org currency may differ from USD, so look at the counts, which don't depend on it.
    await page.goto("/invoices");
    const stats = page.getByTestId("invoice-stats");
    await expect(stats.getByRole("button", { name: "Show outstanding invoices, 3" })).toBeVisible();
    await expect(stats.getByRole("button", { name: "Show overdue invoices, 1" })).toBeVisible();
    await expect(stats.getByRole("button", { name: /Show invoices due in 7 days, 1/ })).toBeVisible();
    await expect(stats).toContainText("Paid this month");
    await expect(stats).toContainText("1 payment");

    await stats.getByRole("button", { name: "Show overdue invoices, 1" }).click();
    await expect(page).toHaveURL(/card=overdue/);
    await expect(page.getByRole("link", { name: late.number })).toBeVisible();
    await expect(page.getByRole("link", { name: soon.number })).toHaveCount(0);
    await stats.getByRole("button", { name: "Show overdue invoices, 1" }).click();
    await expect(page.getByRole("link", { name: soon.number })).toBeVisible();
  });

  test.describe("in a day-first browser", () => {
    test.use({ locale: "en-GB" });

    test("the page renders without a hydration error, and Paid this month says since the 1st", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await signUpNewOrg(page, { name: "Invoice Owner", email: `e2e-inv-27b-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
      await page.goto("/invoices");
      const stats = page.getByTestId("invoice-stats");
      await expect(stats).toContainText(/Received since (1 [A-Z][a-z]{2}|[A-Z][a-z]{2} 1)\b/);
      expect(errors.filter((e) => /hydrat|#418|#423|#425/i.test(e))).toEqual([]);
    });
  });
});
