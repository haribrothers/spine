import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-TAX-08", () => {
  test("record a tax payment using input tax, refuse too much input tax, delete it, then record a refund", async ({ page }) => {
    await signUpNewOrg(page, { name: "Tax Owner", email: `e2e-tax-08-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown): Promise<T> => {
      const res = await page.request.post(`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    const today = new Date().toISOString().slice(0, 10);
    const gst = await post<{ id: string }>("/tax-rates", { name: "GST 18%", rate: 18 });
    // $18.00 of output tax on a $100.00 invoice, and $9.00 of input tax on $59.00 of bank charges.
    const customer = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments" });
    const draft = await post<{ id: string }>("/invoices", { contactId: customer.id, currency: "USD", lines: [{ name: "Kitchen fit-out", quantity: 1, unitPriceAmount: "10000", taxRateId: gst.id }] });
    await post(`/invoices/${draft.id}/issue`);
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const charges = Object.values(grouped).flat().find((a) => a.code === "6900")!;
    await post("/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: charges.id, amount: "5900", taxRateId: gst.id, date: today });

    await page.goto("/reports?tab=tax");
    await page.getByRole("button", { name: "Record tax payment" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("tax-payment-figures")).toContainText("Tax collected$18.00");
    await expect(dialog.getByTestId("tax-payment-figures")).toContainText("Input tax available$9.00");
    await expect(dialog.getByTestId("tax-payment-figures")).toContainText("Net payable$9.00");
    await expect(dialog.getByRole("textbox", { name: "Input tax used" })).toHaveValue("9.00");
    await expect(dialog.getByRole("textbox", { name: "Amount paid" })).toHaveValue("9.00");
    await expect(dialog).toContainText("You have $9.00 to use.");
    await expect(dialog.getByTestId("tax-payment-preview")).toContainText("Posts Dr Output Tax Payable $18.00 / Cr Input Tax Receivable $9.00 / Cr ");

    await dialog.getByRole("textbox", { name: "Input tax used" }).fill("9.01");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(dialog).toContainText("You have $9.00 of input tax to use. Lower the amount.");
    await dialog.getByRole("textbox", { name: "Input tax used" }).fill("9");
    await dialog.getByRole("textbox", { name: "Reference" }).fill("Q3 sales tax return");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Tax payment recorded").first()).toBeVisible();
    const list = page.getByTestId("tax-payments");
    await expect(list).toContainText("Tax payment for");
    await expect(list).toContainText("Q3 sales tax return");
    await expect(list).toContainText("$9.00 + $9.00 input tax");
    // The summary's own figures don't move.
    await expect(page.getByTestId("tax-summary-cards")).toContainText("$18.00");

    await list.getByRole("button", { name: /Delete tax payment/ }).click();
    await expect(list).toContainText("Deleted");

    await page.getByRole("button", { name: "Record tax payment" }).click();
    await dialog.getByRole("button", { name: "Record a tax refund instead" }).click();
    await expect(dialog.getByRole("heading", { name: "Record tax refund" })).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Amount" })).toHaveValue("9.00");
    await dialog.getByRole("button", { name: "Record refund" }).click();
    await expect(page.getByText("Tax refund recorded").first()).toBeVisible();
    await expect(list).toContainText("Tax refund");
  });
});
