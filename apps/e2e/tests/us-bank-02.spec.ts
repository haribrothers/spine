import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-BANK-02", () => {
  test("Banking shows balances and reconciliation; the register lists entries with a running balance", async ({ page }) => {
    await signUpNewOrg(page, { name: "Register Owner", email: `e2e-bank-02-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async (path: string, data: unknown) => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return res.json();
    };
    const contact = await post("/contacts", { type: "customer", name: "Maple Ridge Developments" });
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await post("/payments", { contactId: contact.id, date: iso, method: "bank_transfer", reference: "INV-0011", currency: "USD", amount: "454250" });
    await post("/money-accounts", { kind: "card", name: "Business Visa" });

    await page.goto("/banking");
    const table = page.getByTestId("money-accounts-table");
    const bankRow = table.getByRole("row", { name: /Bank Account/ });
    await expect(bankRow).toContainText("$4,542.50");
    await expect(bankRow).toContainText("Never reconciled");
    await expect(bankRow).toContainText("1 entry");
    await expect(page.getByText("Not yet reconciled")).toBeVisible();

    await bankRow.getByRole("link", { name: "Bank Account" }).click();
    await page.waitForURL(/\/banking\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Bank Account" })).toBeVisible();
    await expect(page.getByText("Bank account · ledger 1010")).toBeVisible();
    const register = page.getByTestId("register-table");
    const entry = register.getByRole("row", { name: /Payment RCP-/ });
    await expect(entry).toContainText("Maple Ridge Developments");
    await expect(entry).toContainText("INV-0011");
    await expect(entry).toContainText("$4,542.50");
    await expect(entry).toContainText("Not reconciled");
    await expect(register).toContainText("Opening balance on");

    await page.getByRole("combobox", { name: "Which entries" }).click();
    await page.getByRole("option", { name: "Unreconciled only" }).click();
    await expect(register.getByRole("row", { name: /Payment RCP-/ })).toBeVisible();

    await entry.getByRole("link", { name: /Payment RCP-/ }).click();
    await page.waitForURL(/\/payments\?id=/);
    await expect(page.getByRole("dialog")).toContainText("Maple Ridge Developments");

    // An empty account, and a card's own column names.
    await page.goto("/banking");
    await table.getByRole("link", { name: "Cash in Hand" }).click();
    await expect(page.getByText("Nothing has gone in or out of this account yet.")).toBeVisible();
    await page.goto("/banking");
    await table.getByRole("link", { name: "Business Visa" }).click();
    await expect(page.getByText("Owed on this card")).toBeVisible();
    await expect(page.getByText("Spent", { exact: true })).toBeVisible();
    await expect(page.getByText("Paid off", { exact: true })).toBeVisible();
  });
});
