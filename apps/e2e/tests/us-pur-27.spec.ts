import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-PUR-27", () => {
  test("a credit with a refund can't be voided; once removed it voids with a reason", async ({ page }) => {
    await signUpNewOrg(page, { name: "Void Buyer", email: `e2e-pur-27-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown): Promise<T> => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const vendor = await post<{ id: string }>("/contacts", { type: "vendor", name: "Coastal Timber Supply" });
    const credit = await post<{ id: string }>("/vendor-credits", { contactId: vendor.id, vendorReference: "CN-4471", date: "2026-10-03", currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "40000" }] });
    await post(`/vendor-credits/${credit.id}/record`);
    await post(`/vendor-credits/${credit.id}/refunds`, { amount: "1000", date: "2026-10-04", method: "cash" });

    await page.goto(`/vendor-credits/${credit.id}`);
    const voidIt = async (reason: string) => {
      await page.getByRole("button", { name: "More" }).click();
      await page.getByRole("menuitem", { name: "Void credit" }).click();
      const dialog = page.getByRole("dialog", { name: "Void VCR-0001?" });
      await dialog.getByRole("button", { name: "Void credit" }).click();
      await expect(dialog).toContainText("Give a reason for voiding this credit.");
      await dialog.getByLabel(/Reason/).fill(reason);
      await dialog.getByRole("button", { name: "Void credit" }).click();
      return dialog;
    };
    const first = await voidIt("Entered twice");
    await expect(first).toContainText("Remove its 1 applications and refunds first.");
    await first.getByRole("button", { name: "Go back" }).click();

    await page.getByTestId("vendor-refunds").getByRole("button", { name: /^Actions for the/ }).click();
    await page.getByRole("menuitem", { name: "Delete refund" }).click();
    await page.getByRole("alertdialog", { name: "Delete this refund?" }).getByRole("button", { name: "Delete refund" }).click();
    await expect(page.getByTestId("vendor-refunds")).toContainText("Deleted");
    await voidIt("Entered twice");
    await expect(page.getByText("Void — Entered twice")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply to bills" })).toHaveCount(0);
  });
});
