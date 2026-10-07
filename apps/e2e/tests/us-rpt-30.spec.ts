import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-RPT-30", () => {
  test("payments received with allocations and an account filter; payments made for bills", async ({ page }) => {
    await signUpNewOrg(page, { name: "Register Owner", email: `e2e-rpt-30-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const accounts = (await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string; name: string }[];
    const bank = accounts.find((a) => a.code === "1010")!;
    const cash = accounts.find((a) => a.code === "1000")!;
    const maple = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments" });
    const blue = await post<{ id: string }>("/contacts", { type: "customer", name: "Bluewater Hospitality Group" });
    const draft = await post<{ id: string }>("/invoices", { contactId: maple.id, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: "875000" }] });
    const invoice = await post<{ id: string; number: string }>(`/invoices/${draft.id}/issue`);
    await post("/payments", { contactId: maple.id, date: today(), method: "bank_transfer", currency: "USD", amount: "875000", moneyAccountId: bank.id, allocations: [{ invoiceId: invoice.id, amount: "875000" }] });
    await post("/payments", { contactId: blue.id, date: today(), method: "cheque", currency: "USD", amount: "500000", moneyAccountId: cash.id });
    const timber = await post<{ id: string }>("/contacts", { type: "vendor", name: "Coastal Timber Supply" });
    const bill = await post<{ id: string }>("/vendor-bills", { contactId: timber.id, billNumber: "88213", date: today(), currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: "216000", accountId: code("5000") }] });
    await post(`/vendor-bills/${bill.id}/record`);
    await post("/vendor-payments", { contactId: timber.id, date: today(), method: "bank_transfer", currency: "USD", amount: "216000", moneyAccountId: bank.id, allocations: [{ billId: bill.id, amount: "216000" }] });

    await page.goto("/reports");
    await page.getByRole("link", { name: "Payments received" }).click();
    await expect(page).toHaveURL(/\/reports\/payments-received$/);
    const cards = page.getByTestId("register-cards");
    await expect(cards).toContainText("Payments2");
    await expect(cards).toContainText("Received$13,750.00");
    await expect(cards).toContainText("Held as credit$5,000.00");
    const table = page.getByTestId("register-table");
    const maples = table.getByRole("row", { name: /Maple Ridge Developments/ });
    await expect(maples).toContainText("Bank transfer");
    await expect(maples).toContainText(bank.name);
    await expect(maples.getByRole("link", { name: invoice.number })).toBeVisible();
    await expect(table.getByRole("row", { name: /Bluewater Hospitality Group/ })).toContainText("Held as credit");

    await page.getByRole("combobox", { name: "Account" }).click();
    await page.getByRole("option", { name: cash.name }).click();
    await expect(table.getByRole("row", { name: /Maple Ridge Developments/ })).toHaveCount(0);
    await expect(table.getByRole("row", { name: /Bluewater Hospitality Group/ })).toBeVisible();

    await page.getByRole("tab", { name: "Payments made" }).click();
    await expect(page).toHaveURL(/\/reports\/payments-made$/);
    const timberRow = page.getByTestId("register-table").getByRole("row", { name: /Coastal Timber Supply/ });
    await expect(timberRow).toContainText("$2,160.00");
    await expect(timberRow.getByRole("link", { name: "88213" })).toHaveAttribute("href", `/vendor-bills/${bill.id}`);
  });
});
