import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-PUR-26", () => {
  test("record a vendor's refund into an account, then delete it", async ({ page }) => {
    await signUpNewOrg(page, { name: "Refund Buyer", email: `e2e-pur-26-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown): Promise<T> => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const vendor = await post<{ id: string }>("/contacts", { type: "vendor", name: "Coastal Timber Supply" });
    const credit = await post<{ id: string }>("/vendor-credits", { contactId: vendor.id, vendorReference: "CN-4471", date: "2026-10-03", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "40000" }] });
    await post(`/vendor-credits/${credit.id}/record`);

    await page.goto(`/vendor-credits/${credit.id}`);
    await page.getByRole("button", { name: "Record refund" }).click();
    const dialog = page.getByRole("dialog");
    const amount = dialog.locator('input[inputmode="decimal"]');
    await expect(amount).toHaveValue("400.00");
    await amount.fill("400.01");
    await dialog.getByRole("button", { name: "Record refund" }).click();
    await expect(dialog).toContainText("This credit has $400.00 left to refund.");
    await amount.fill("150");
    await expect(dialog.getByRole("combobox", { name: "Paid into" })).toHaveText("Bank Account");
    await dialog.getByLabel("Reference").fill("EFT-88");
    await dialog.getByRole("button", { name: "Record refund" }).click();

    const refunds = page.getByTestId("vendor-refunds");
    await expect(refunds).toContainText("Bank Account · EFT-88");
    await expect(page.getByTestId("credit-balance")).toHaveText("Open — $250.00 to use");
    await refunds.getByRole("button", { name: "Delete refund of $150.00" }).click();
    await expect(refunds).toContainText("Deleted");
    await expect(page.getByTestId("credit-balance")).toHaveText("Open — $400.00 to use");
  });
});
