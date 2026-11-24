import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, contact } from "./quote-seed";
import { taxedInvoice } from "./credit-note-seed";

test.describe("US-INV-36", () => {
  test("credits invoice lines with their tax, shows the totals first, and limits each line to what's left", async ({ page }) => {
    await signUpNewOrg(page, { name: "Credit Owner", email: `e2e-inv-36-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Sahyadri Retail");
    const inv = await taxedInvoice(page, c.id);

    await page.goto(`/invoices/${inv.id}`);
    await page.getByTestId("invoice-actions").getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Issue credit note" }).click();
    const dialog = page.getByRole("dialog", { name: "Issue a credit note" });
    await expect(dialog).toContainText(`Against ${inv.number}`);
    const lines = dialog.getByTestId("credit-lines");
    await expect(lines.getByRole("row", { name: /Loading bay canopy/ })).toContainText("36 of 36 left");
    await dialog.getByRole("checkbox", { name: "Credit Loading bay canopy" }).check();
    await dialog.getByLabel("How many of Loading bay canopy to credit").fill("12");
    await dialog.getByLabel("Reason").fill("Canopy reduced from 36 to 24 m²");
    // 12 × $42.00 = $504.00 + 10% = $554.40.
    const totals = dialog.getByTestId("credit-totals");
    await expect(totals).toContainText("$504.00");
    await expect(totals).toContainText("$50.40");
    await expect(totals).toContainText("$554.40");
    await expect(lines.getByRole("row", { name: /Loading bay canopy/ })).toContainText("$554.40");
    await dialog.getByRole("button", { name: "Issue credit note" }).click();
    await expect(page.getByText(/^CRN-\d{4} issued$/).first()).toBeVisible();

    // What's left on the line is 24.
    const left = await api<{ lines: { leftQuantity: number }[] }>(page, "GET", `/credit-notes/creditable?invoiceId=${inv.id}`);
    expect(left.lines[0]!.leftQuantity).toBe(24);
    await page.getByTestId("invoice-actions").getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Issue credit note" }).click();
    await expect(dialog.getByTestId("credit-lines").getByRole("row", { name: /Loading bay canopy/ })).toContainText("24 of 36 left");
    await dialog.getByRole("checkbox", { name: "Credit Loading bay canopy" }).check();
    await dialog.getByLabel("How many of Loading bay canopy to credit").fill("30");
    await expect(dialog.getByText("Line 1 has 24 left to credit.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Issue credit note" })).toBeDisabled();
  });
});
