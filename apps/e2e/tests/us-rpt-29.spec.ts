import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-RPT-29", () => {
  test("expenses by category with shares, largest first, and purchases by vendor net of credits", async ({ page }) => {
    await signUpNewOrg(page, { name: "Spend Owner", email: `e2e-rpt-29-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const vendor = await post<{ id: string }>("/contacts", { type: "vendor", name: "Coastal Timber Supply" });
    const bill = await post<{ id: string }>("/vendor-bills", { contactId: vendor.id, billNumber: "88213", date: today(), currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: "300000", accountId: code("5000") }] });
    await post(`/vendor-bills/${bill.id}/record`);
    const credit = await post<{ id: string }>("/vendor-credits", { contactId: vendor.id, vendorReference: "CN-1", date: today(), currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "50000", accountId: code("5000") }] });
    await post(`/vendor-credits/${credit.id}/record`);
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    await post("/bank-transactions", { moneyAccountId: bank.id, direction: "out", accountId: code("6000"), amount: "50000", date: today() });

    await page.goto("/reports");
    await page.getByRole("link", { name: "Expenses by category" }).click();
    await expect(page).toHaveURL(/\/reports\/expenses-by-category$/);
    await expect(page.locator("main h1 + p")).toContainText("From bills, expenses, journals and money out · ");
    const cards = page.getByTestId("purchases-cards");
    await expect(cards).toContainText("Total expenses$3,000.00");
    await expect(cards).toContainText("Categories2");
    await expect(cards).toContainText("Largest category$2,500.00Cost of Materials · 83.3%");
    const table = page.getByTestId("purchases-table");
    await expect(table.getByRole("row").nth(1)).toContainText("5000 · Cost of Materials");
    await expect(table.getByRole("row").nth(1)).toContainText("83.3%");
    await expect(table.getByRole("progressbar").first()).toBeVisible();
    await table.getByRole("button", { name: "5000 · Cost of Materials" }).click();
    await expect(page.getByRole("dialog")).toContainText("5000 — Cost of Materials");
    await page.keyboard.press("Escape");

    await page.getByRole("tab", { name: "Purchases by vendor" }).click();
    await expect(page).toHaveURL(/\/reports\/purchases-by-vendor$/);
    const row = table.getByRole("row", { name: /Coastal Timber Supply/ });
    await expect(row).toContainText("$2,500.00");
    await row.getByRole("button", { name: "Coastal Timber Supply" }).click();
    await page.getByRole("dialog", { name: "Bills from Coastal Timber Supply" }).getByRole("link", { name: "88213" }).click();
    await expect(page).toHaveURL(new RegExp(`/vendor-bills/${bill.id}$`));
  });
});
