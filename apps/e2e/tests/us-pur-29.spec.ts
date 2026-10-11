import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-PUR-29", () => {
  test("Make recurring on a bill opens the dialog with its vendor and lines; the schedule shows in Recurring bills", async ({ page }) => {
    await signUpNewOrg(page, { name: "Recurring Owner", email: `e2e-pur-29-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const vendor = await post<{ id: string }>("/contacts", { type: "vendor", name: "Harbourside Properties" });
    const bill = await post<{ id: string }>("/vendor-bills", { contactId: vendor.id, billNumber: "OCT-RENT", date: today(), currency: "USD", lines: [{ type: "item", name: "Office rent", quantity: 1, unitPriceAmount: "240000", accountId: code("6000") }] });

    await page.goto("/vendor-bills");
    await expect(page.getByRole("link", { name: "Recurring bills" })).toBeVisible();
    await page.goto(`/vendor-bills/${bill.id}`);
    // US-PUR-32: Make recurring sits in the bill's More menu.
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Make recurring" }).click();
    const dialog = page.getByRole("dialog", { name: "New recurring bill" });
    await expect(dialog).toContainText("Lines: Office rent × 1 · $2,400.00");
    await expect(dialog.getByRole("combobox", { name: "Repeat" })).toHaveText("Monthly");
    await expect(dialog.getByRole("radio", { name: "Record the bill" })).toBeChecked();
    await dialog.getByRole("textbox", { name: "Name" }).fill("Office rent");
    await dialog.getByRole("combobox", { name: "Paid from" }).click();
    await page.getByRole("option", { name: "Bank Account" }).click();
    await dialog.getByRole("button", { name: "Save schedule" }).click();

    await expect(page).toHaveURL(/\/vendor-bills\/recurring$/);
    const row = page.getByTestId("recurring-bills-table").getByRole("row", { name: /Office rent/ });
    await expect(row).toContainText("Harbourside Properties");
    await expect(row).toContainText("Monthly · 1st");
    await expect(row).toContainText("$2,400.00");
    await expect(row).toContainText("Active");
    await expect(row).toContainText("Record");
  });
});
