import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-BANK-06", () => {
  test("archive only an empty, non-default account; it leaves the pickers and can be restored", async ({ page }) => {
    await signUpNewOrg(page, { name: "Archive Owner", email: `e2e-bank-06-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async (path: string, data?: unknown) => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return res.json();
    };
    const accounts = (await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[];
    const bank = accounts.find((a) => a.code === "1010")!;
    const old = await post("/money-accounts", { kind: "bank", name: "Old savings" });
    await post("/bank-transfers", { fromMoneyAccountId: bank.id, toMoneyAccountId: old.id, amount: "100000", date: "2026-09-01" });

    await page.goto("/banking");
    const table = page.getByTestId("money-accounts-table");
    // US-BANK-13: Archive asks first (the default account says why it can't instead).
    const archive = async (name: string, ask = true) => {
      await table.getByRole("button", { name: `Actions for ${name}` }).click();
      await page.getByRole("menuitem", { name: "Archive" }).click();
      if (!ask) return;
      const confirm = page.getByRole("alertdialog", { name: `Archive ${name}?` });
      await expect(confirm).toContainText("It leaves the account pickers");
      await confirm.getByRole("button", { name: "Archive account" }).click();
    };

    await archive("Old savings");
    await expect(page.getByText("Move the $1,000.00 out of this account before archiving it.").first()).toBeVisible();
    await archive("Bank Account", false);
    await expect(page.getByText("Choose another default account first.").first()).toBeVisible();

    await post("/bank-transfers", { fromMoneyAccountId: old.id, toMoneyAccountId: bank.id, amount: "100000", date: "2026-09-02" });
    await page.reload();
    await archive("Old savings");
    await expect(page.getByText("Account archived").first()).toBeVisible();
    await expect(table.getByRole("row", { name: /Old savings/ })).toHaveCount(0);

    await page.getByRole("tab", { name: /^Archived/ }).click();
    await expect(page).toHaveURL(/tab=archived/);
    await expect(table.getByRole("row", { name: /Old savings/ })).toBeVisible();

    // Gone from the payment picker.
    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    await page.getByRole("dialog").getByRole("combobox", { name: "Paid into" }).click();
    await expect(page.getByRole("option", { name: "Bank Account" })).toBeVisible();
    await expect(page.getByRole("option", { name: /Old savings/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.goto("/banking");
    await page.getByRole("tab", { name: /^Archived/ }).click();
    await table.getByRole("button", { name: "Actions for Old savings" }).click();
    await page.getByRole("menuitem", { name: "Restore" }).click();
    await expect(page.getByText("Account restored").first()).toBeVisible();
    await page.getByRole("tab", { name: /^Active/ }).click();
    await expect(table.getByRole("row", { name: /Old savings/ })).toBeVisible();
  });
});
