import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { contact } from "./quote-seed";
import { creditFirstLine, payInFull, taxedInvoice } from "./credit-note-seed";

test.describe("US-INV-38", () => {
  test("the page leads with where the money went and Apply credit while credit is left", async ({ page }) => {
    await signUpNewOrg(page, { name: "Credit Owner", email: `e2e-inv-38-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Sahyadri Retail");
    const paid = await taxedInvoice(page, c.id);
    await payInFull(page, c.id, paid);
    const other = await taxedInvoice(page, c.id);
    // 10 × $42.00 + 10% = $462.00, all of it credit (the invoice is paid).
    const note = await creditFirstLine(page, paid.id, 10);

    await page.goto(`/credit-notes/${note.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(note.number);
    await expect(page.getByTestId("credit-note-state")).toHaveText("Credit left");
    await expect(page.getByTestId("credit-note-reason")).toHaveText("Canopy reduced");
    await expect(page.getByTestId("fig-credited")).toContainText("$462.00");
    await expect(page.getByTestId("fig-left")).toContainText("$462.00");
    await expect(page.getByTestId("fig-off")).toHaveCount(0);
    await expect(page.getByTestId("credit-note-lines").getByRole("row", { name: /Loading bay canopy/ })).toContainText("$462.00");
    await expect(page.getByTestId("credit-note-totals")).toContainText("Credit left");

    await page.getByTestId("credit-note-actions").getByRole("button", { name: "Apply credit" }).click();
    const apply = page.getByRole("dialog", { name: "Apply credit" });
    await apply.getByLabel(`Amount to apply to ${other.number}`).fill("200");
    await apply.getByRole("button", { name: "Apply credit" }).click();
    await expect(page.getByText("Credit applied", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("fig-applied")).toContainText("$200.00");
    await expect(page.getByTestId("fig-applied")).toContainText(`To ${other.number}`);
    await expect(page.getByTestId("fig-left")).toContainText("$262.00");

    // The invoice links to it: its credit notes and Activity.
    await page.goto(`/invoices/${other.id}`);
    await page.getByTestId("invoice-activity").getByRole("link", { name: note.number }).click();
    await expect(page).toHaveURL(new RegExp(`/credit-notes/${note.id}$`));
  });
});
