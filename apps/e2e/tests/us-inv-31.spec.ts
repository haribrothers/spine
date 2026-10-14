import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { invoice, issue, pay } from "./invoice-seed";

test.describe("US-INV-31", () => {
  test("the lines are a table, with the totals, Paid and Balance due under them", async ({ page }) => {
    await signUpNewOrg(page, { name: "Invoice Owner", email: `e2e-inv-31-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const inv = await invoice(page, c.id, { lines: [{ name: "Tiling", price: "50000", quantity: 2, description: "Vitrified tiles", tax: 10 }] });
    await issue(page, inv.id);
    await pay(page, c.id, inv.id, "30000");

    await page.goto(`/invoices/${inv.id}`);
    const lines = page.getByTestId("invoice-lines");
    await expect(lines.getByRole("columnheader")).toHaveText(["Item", "Qty", "Rate", "Tax", "Amount"]);
    await expect(lines.getByRole("row", { name: /Tiling/ })).toContainText("Vitrified tiles");
    const totals = page.getByTestId("invoice-totals");
    await expect(totals).not.toContainText("Discount");
    await expect(totals).toContainText("$1,100.00");
    await expect(totals).toContainText("Paid");
    await expect(totals).toContainText("−$300.00");
    await expect(totals).toContainText("Balance due");
    await expect(totals).toContainText("$800.00");
  });
});
