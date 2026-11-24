import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-PAY-16", () => {
  test("credit a paid invoice, keep the excess as credit, and apply it to another invoice", async ({ page }) => {
    await signUpNewOrg(page, { name: "Credit Owner", email: `e2e-pay-16-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown): Promise<T> => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const contact = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments" });
    const invoice = async (amount: string) => {
      const draft = await post<{ id: string }>("/invoices", { contactId: contact.id, currency: "USD", lines: [{ name: "Kitchen fit-out", quantity: 1, unitPriceAmount: amount }] });
      return post<{ id: string; number: string }>(`/invoices/${draft.id}/issue`);
    };
    const paid = await invoice("100000");
    const today = new Date().toISOString().slice(0, 10);
    await post("/payments", { contactId: contact.id, date: today, method: "bank_transfer", currency: "USD", amount: "100000", allocations: [{ invoiceId: paid.id, amount: "100000" }] });
    const open = await invoice("45425");

    await page.goto(`/invoices/${paid.id}`);
    // US-INV-30: the paid invoice's next step is Download PDF; credit notes are under More.
    await page.getByTestId("invoice-actions").getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Issue credit note" }).click();
    const dialog = page.getByRole("dialog");
    // US-INV-36: credit an amount, spread over the invoice's lines.
    await dialog.getByRole("tab", { name: "Credit an amount" }).click();
    await dialog.getByLabel("Amount to credit").fill("300");
    await expect(dialog.getByTestId("credit-split")).toHaveText(`$0.00 reduces what's owed on ${paid.number}; $300.00 becomes credit for Maple Ridge Developments.`);
    await dialog.getByRole("button", { name: "Issue credit note" }).click();
    await expect(page.getByText(/^CRN-\d{4} issued$/).first()).toBeVisible();

    await page.goto(`/invoices/${open.id}`);
    const more = page.getByTestId("invoice-actions").getByRole("button", { name: "More" });
    await more.click();
    await page.getByRole("menuitem", { name: "Apply credit" }).click();
    const apply = page.getByRole("dialog");
    const source = apply.getByTestId("credit-source");
    await expect(source).toContainText(/Credit note CRN-/);
    await expect(source).toContainText("$300.00 available");
    await expect(apply.getByRole("textbox", { name: /Amount from Credit note/ })).toHaveValue("300.00");
    await apply.getByRole("button", { name: "Apply credit" }).click();
    await expect(page.getByText("Credit applied").first()).toBeVisible();
    await expect(page.getByText("$154.25").first()).toBeVisible();
    await more.click();
    await expect(page.getByRole("menuitem", { name: "Issue credit note" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Apply credit" })).toHaveCount(0);
  });
});
