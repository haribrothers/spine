import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { invoice, issue, pay } from "./invoice-seed";

test.describe("US-INV-29", () => {
  test("each row has one status, when it's due or was paid, and the next actions in its menu", async ({ page }) => {
    await signUpNewOrg(page, { name: "Invoice Owner", email: `e2e-inv-29-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const late = await issue(page, (await invoice(page, c.id, { issueDays: -40, dueDays: -6 })).id);
    const part = await issue(page, (await invoice(page, c.id, { issueDays: -2, dueDays: 2 })).id);
    await pay(page, c.id, part.id, "40000");
    const paid = await issue(page, (await invoice(page, c.id, { issueDays: -5, dueDays: 25 })).id);
    await pay(page, c.id, paid.id, "100000");
    await invoice(page, c.id);

    await page.goto("/invoices");
    const row = (name: string) => page.getByRole("row").filter({ has: page.getByRole("link", { name }) });
    await expect(row(late.number).getByTestId("invoice-state")).toHaveText("Overdue");
    await expect(row(late.number).getByTestId("invoice-due")).toHaveText("Overdue 6 days");
    await expect(row(part.number).getByTestId("invoice-state")).toHaveText("Part paid");
    await expect(row(part.number).getByTestId("invoice-due")).toHaveText("in 2 days");
    await expect(row(part.number).getByRole("img", { name: "40% paid" })).toBeVisible();
    await expect(row(paid.number).getByTestId("invoice-state")).toHaveText("Paid");
    await expect(row(paid.number).getByTestId("invoice-due")).toContainText("Paid");
    await expect(page.getByRole("row").filter({ hasText: "Draft" }).getByTestId("invoice-state")).toHaveText("Draft");

    await row(late.number).getByRole("button", { name: /actions/i }).click();
    for (const item of ["Record payment", "Send reminder", "Duplicate"]) await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
    await page.getByRole("menuitem", { name: "Record payment" }).click();
    await expect(page).toHaveURL(new RegExp(`/invoices/${late.id}$`));
    await expect(page.getByRole("dialog")).toContainText("Record payment");
  });
});
