import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-RPT-19", () => {
  test("review the trial balance, lock (warned about adjustments), see everything read-only, then unlock", async ({ page }) => {
    await signUpNewOrg(page, { name: "Lock Owner", email: `e2e-rpt-19-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const res = await page.request.put(`${API_URL}/opening-balances`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { cutoverDate: "2026-07-01", lines: [{ accountId: code("1010"), debit: "100000", credit: "0" }, { accountId: code("3000"), debit: "0", credit: "90000" }] },
    });
    expect(res.ok()).toBe(true);

    await page.goto("/opening-balances");
    await page.getByRole("tab", { name: "Review" }).click();
    await expect(page.getByRole("heading", { name: "Trial balance on Jun 30, 2026" })).toBeVisible();
    const tb = page.getByTestId("review-trial-balance");
    await expect(tb.getByRole("row").filter({ hasText: "Opening Balance Adjustments" })).toContainText("$100.00");
    await expect(page.getByTestId("review-adjustment")).toContainText("$100.00");

    await page.getByRole("button", { name: "Lock opening balances" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText("Spine closes everything up to Jun 30, 2026 so nobody changes your starting point.");
    await expect(confirm).toContainText("Opening Balance Adjustments still holds $100.00. Lock anyway?");
    await confirm.getByRole("button", { name: "Go back" }).click();
    await expect(confirm).toHaveCount(0);
    await page.getByRole("button", { name: "Lock opening balances" }).click();
    await confirm.getByRole("button", { name: "Lock anyway" }).click();
    await expect(page.getByText(/^Locked on /)).toBeVisible();

    // Read-only everywhere.
    await page.getByRole("tab", { name: "Account balances" }).click();
    await expect(page.getByRole("textbox", { name: "Bank Account debit" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save balances" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Customer invoices" }).click();
    await expect(page.getByRole("button", { name: "Add invoice" })).toHaveCount(0);

    await page.getByRole("tab", { name: "Review" }).click();
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(confirm).toContainText("Everything up to Jun 30, 2026 opens again so the opening balances can be changed.");
    await confirm.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("button", { name: "Lock opening balances" })).toBeVisible();
    await page.getByRole("tab", { name: "Account balances" }).click();
    await expect(page.getByRole("button", { name: "Save balances" })).toBeVisible();
  });
});
