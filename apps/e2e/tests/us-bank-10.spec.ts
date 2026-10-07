import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-BANK-10", () => {
  test("finish only at zero; entries get the tick, the account shows Last reconciled, and reconciled documents can't be deleted", async ({ page }) => {
    await signUpNewOrg(page, { name: "Finish Owner", email: `e2e-bank-10-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown): Promise<T> => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    const contact = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments" });
    const payment = await post<{ id: string; number: string }>("/payments", { contactId: contact.id, date: "2026-10-02", method: "bank_transfer", currency: "USD", amount: "454250", moneyAccountId: bank.id });
    const res = await page.request.post(`${API_URL}/money-accounts/${bank.id}/statement-imports`, {
      headers: { "Idempotency-Key": randomUUID() },
      multipart: {
        file: { name: "statement.csv", mimeType: "text/csv", buffer: Buffer.from("Date,Description,Amount\n2026-10-02,NEFT-MAPLE RIDGE DEV,4542.50\n") },
        mapping: JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount" }),
      },
    });
    expect(res.ok()).toBe(true);

    await page.goto(`/banking/${bank.id}/reconcile`);
    await page.getByRole("textbox", { name: "Closing balance on the statement" }).fill("4,542.50");
    await page.getByRole("button", { name: "Start reconciling" }).click();
    const footer = page.getByTestId("reconcile-footer");
    await expect(footer).toContainText("Difference $4,542.50 — match or create entries until it's zero.");
    await expect(footer.getByRole("button", { name: "Finish reconciliation" })).toBeDisabled();

    await page.getByTestId("statement-line").filter({ hasText: "NEFT-MAPLE RIDGE DEV" }).getByRole("button", { name: "Match" }).click();
    await expect(footer).toContainText("Spine agrees with the statement · 1 lines matched.");
    await footer.getByRole("button", { name: "Finish reconciliation" }).click();
    await expect(page.getByText(/Bank Account is reconciled to .+\. Its entries show the Reconciled tick/)).toBeVisible();

    await page.getByRole("link", { name: "register" }).click();
    await expect(page.getByTestId("register-table")).toContainText("Reconciled");
    await expect(page.getByTestId("register-table")).not.toContainText("Not reconciled");
    await page.goto("/banking");
    await expect(page.getByText("Never reconciled")).toHaveCount(1); // Cash in Hand only

    // A reconciled payment can't be deleted.
    await page.goto(`/payments?id=${payment.id}`);
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete payment" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(drawer).toContainText(/This entry is part of a finished reconciliation of Bank Account to .+\. Undo that reconciliation first\./);
  });
});
