import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-PUR-25", () => {
  test("pay-bill suggests the credit; apply it oldest first; the bill lists it", async ({ page }) => {
    await signUpNewOrg(page, { name: "Apply Owner", email: `e2e-pur-25-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown): Promise<T> => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const vendor = await post<{ id: string }>("/contacts", { type: "vendor", name: "Coastal Timber Supply" });
    const bill = async (number: string, amount: string, date: string) => {
      const created = await post<{ id: string }>("/vendor-bills", { contactId: vendor.id, billNumber: number, date, currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: amount }] });
      await post(`/vendor-bills/${created.id}/record`);
      return created.id;
    };
    const older = await bill("88213", "30000", "2026-09-01");
    await bill("88240", "50000", "2026-09-20");
    const credit = await post<{ id: string }>("/vendor-credits", { contactId: vendor.id, vendorReference: "CN-4471", date: "2026-10-03", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "40000" }] });
    await post(`/vendor-credits/${credit.id}/record`);

    // "Pay bill" offers the credit first.
    await page.goto("/vendor-payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    const pay = page.getByRole("dialog");
    await pay.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Coastal Timber Supply" }).click();
    await expect(pay.getByTestId("vendor-credit-note")).toHaveText("Coastal Timber Supply has $400.00 of credit. Apply it first?");
    await pay.getByRole("link", { name: "Apply it first?" }).click();
    await page.waitForURL(`**/vendor-credits/${credit.id}`);

    await page.getByRole("button", { name: "Apply to bills" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("bill-to-apply").first()).toContainText("Bill 88213");
    await expect(dialog.getByRole("textbox", { name: "Amount to apply to bill 88213" })).toHaveValue("300.00");
    await expect(dialog.getByRole("textbox", { name: "Amount to apply to bill 88240" })).toHaveValue("100.00");
    await dialog.getByRole("textbox", { name: "Amount to apply to bill 88213" }).fill("301");
    await dialog.getByRole("button", { name: "Apply credit" }).click();
    await expect(dialog).toContainText("You can apply up to $300.00 to this bill.");
    await dialog.getByRole("textbox", { name: "Amount to apply to bill 88213" }).fill("300");
    await dialog.getByRole("button", { name: "Apply credit" }).click();
    await expect(page.getByText("Used", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("credit-allocations")).toContainText("Bill 88213");

    await page.goto(`/vendor-bills/${older}`);
    await expect(page.getByTestId("credits-applied")).toContainText("VCR-0001 · their CN-4471");
    await expect(page.getByText("Credits applied").last()).toBeVisible();
  });
});
