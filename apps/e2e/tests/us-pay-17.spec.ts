import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { clearInbox, signUpNewOrg, waitForEmail } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-PAY-17", () => {
  test("refund part of an overpayment with a confirmation email, then delete the refund", async ({ page }) => {
    await signUpNewOrg(page, { name: "Refund Owner", email: `e2e-pay-17-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const customerEmail = `maple-${randomUUID()}@example.com`;
    const post = async <T>(path: string, data?: unknown): Promise<T> => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const contact = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments", email: customerEmail });
    const today = new Date().toISOString().slice(0, 10);
    const payment = await post<{ id: string; number: string }>("/payments", { contactId: contact.id, date: today, method: "bank_transfer", currency: "USD", amount: "50000" });

    await clearInbox();
    await page.goto(`/payments?id=${payment.id}`);
    await page.getByRole("dialog").getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Refund", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Refund Maple Ridge Developments" });
    await expect(dialog.getByRole("combobox", { name: "Refund from" })).toHaveText(`Payment ${payment.number}`);
    await expect(dialog).toContainText("$500.00 of credit");
    const amount = dialog.locator('input[inputmode="decimal"]');
    await expect(amount).toHaveValue("500.00");
    await amount.fill("200");
    await expect(dialog.getByRole("combobox", { name: "Paid from" })).toHaveText("Bank Account");
    await dialog.getByLabel("Reference").fill("RF-0001");
    await dialog.getByRole("checkbox", { name: "Send refund confirmation" }).check();
    await dialog.getByRole("button", { name: "Record refund" }).click();
    await expect(page.getByText("Refunded $200.00 to Maple Ridge Developments").first()).toBeVisible();
    const email = await waitForEmail((e) => e.to.some((t) => t.address === customerEmail));
    expect(email.subject).toContain("refunded $200.00");

    const drawer = page.getByRole("dialog").filter({ has: page.getByTestId("refunds") });
    await expect(drawer.getByTestId("refunds")).toContainText("RF-0001");
    await expect(drawer).toContainText("$300.00");
    await drawer.getByRole("button", { name: "Delete refund of $200.00" }).click();
    await expect(drawer.getByTestId("refunds")).toContainText("Deleted");
    await expect(drawer).toContainText("$500.00");

    await page.goto(`/contacts/${contact.id}`);
    await expect(page.getByRole("button", { name: "Refund", exact: true })).toBeVisible();
  });
});
