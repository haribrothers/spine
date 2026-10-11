import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-BANK-03", () => {
  test("payments and expenses name their account, preselect the last one used, and show it read-only", async ({ page }) => {
    await signUpNewOrg(page, { name: "Picker Owner", email: `e2e-bank-03-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async (path: string, data: unknown) => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return res.json();
    };
    await post("/contacts", { type: "customer", name: "Maple Ridge Developments" });
    await post("/money-accounts", { kind: "bank", name: "First Coastal — Operating" });
    await post("/money-accounts", { kind: "card", name: "Business Visa" });

    // Record payment: the organisation default first, then the account used last.
    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    const dialog = page.getByRole("dialog");
    const paidInto = dialog.getByRole("combobox", { name: "Paid into" });
    await expect(paidInto).toHaveText("Bank Account");
    await expect(dialog).toContainText("Your organisation's default account. Change it if the money went into another account.");
    await dialog.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
    await page.getByRole("option", { name: "Maple Ridge Developments" }).click();
    await dialog.locator('input[inputmode="decimal"]').fill("4542.50");
    await paidInto.click();
    await page.getByRole("option", { name: "First Coastal — Operating" }).click();
    await dialog.getByRole("button", { name: "Record payment" }).click();
    // US-PAY-23: the new payment's page opens; it shows the account.
    await page.waitForURL(/\/payments\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("payment-meta")).toContainText("Paid into First Coastal — Operating");

    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    await expect(dialog.getByRole("combobox", { name: "Paid into" })).toHaveText("First Coastal — Operating");
    await expect(dialog).toContainText("Last used by you. Change it if the money went into another account.");
    await page.keyboard.press("Escape");

    await page.goto("/banking");
    await expect(page.getByTestId("money-accounts-table").getByRole("row", { name: /First Coastal — Operating/ })).toContainText("$4,542.50");

    // An expense: the approver changes the account to the card before approving.
    const category = await post("/expense-categories", { name: "Fuel & freight" });
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const expense = await post("/expenses", { categoryId: category.id, date: iso, currency: "USD", amount: "6400", description: "Fuel" });
    await page.goto(`/expenses?id=${expense.id}`);
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText("Paid from");
    await expect(drawer).toContainText("Bank Account");
    await drawer.getByRole("button", { name: "Approve" }).click();
    const approve = page.getByRole("alertdialog");
    const paidFrom = approve.getByRole("combobox", { name: "Paid from" });
    await expect(paidFrom).toHaveText("Bank Account");
    await paidFrom.click();
    await page.getByRole("option", { name: /Business Visa/ }).click();
    await approve.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByRole("dialog")).toContainText("Business Visa");

    await page.goto("/banking");
    await expect(page.getByTestId("money-accounts-table").getByRole("row", { name: /Business Visa/ })).toContainText("$64.00 owed");
  });
});
