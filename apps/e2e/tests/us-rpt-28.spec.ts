import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-RPT-28", () => {
  test("sales by customer, largest first, and by item; a row lists its invoices", async ({ page }) => {
    await signUpNewOrg(page, { name: "Sales Owner", email: `e2e-rpt-28-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const fitout = await post<{ id: string }>("/catalog-items", { name: "Kitchen fit-out", unit: "each", defaultPriceAmount: "100000", defaultPriceCurrency: "USD" });
    const big = await post<{ id: string }>("/contacts", { type: "customer", name: "Sunstone Retail Fitouts" });
    const small = await post<{ id: string }>("/contacts", { type: "customer", name: "Harbour View Strata" });
    const numbers: string[] = [];
    for (const [contactId, quantity] of [[big.id, 3], [small.id, 1]] as const) {
      const draft = await post<{ id: string }>("/invoices", { contactId, currency: "USD", lines: [{ name: "Kitchen fit-out", quantity, unitPriceAmount: "100000", catalogItemId: fitout.id }] });
      numbers.push((await post<{ number: string }>(`/invoices/${draft.id}/issue`)).number);
    }
    await post("/invoices/" + (await post<{ id: string }>("/invoices", { contactId: small.id, currency: "USD", lines: [{ name: "Callout", quantity: 2, unitPriceAmount: "5000" }] })).id + "/issue");

    await page.goto("/reports");
    await page.getByRole("link", { name: "Sales by customer" }).click();
    await expect(page).toHaveURL(/\/reports\/sales-by-customer$/);
    await expect(page.locator("main h1 + p")).toContainText("Net of credit notes · ");
    const cards = page.getByTestId("sales-cards");
    await expect(cards).toContainText("Customers2");
    await expect(cards).toContainText("Invoices3");
    await expect(cards).toContainText("Sales before tax$4,100.00");
    const table = page.getByTestId("sales-table");
    await expect(table.getByRole("row").nth(1)).toContainText("Sunstone Retail Fitouts");
    await expect(table.getByRole("row").nth(1)).toContainText("73.2%");
    await expect(table.getByRole("row").nth(2)).toContainText("Harbour View Strata");

    await table.getByRole("button", { name: "Sunstone Retail Fitouts" }).click();
    const dialog = page.getByRole("dialog", { name: "Invoices for Sunstone Retail Fitouts" });
    await expect(dialog.getByRole("link", { name: numbers[0]! })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("tab", { name: "Sales by item" }).click();
    await expect(page).toHaveURL(/\/reports\/sales-by-item$/);
    await expect(table.getByRole("row").nth(1)).toContainText("Kitchen fit-out");
    await expect(table.getByRole("row").nth(1)).toContainText("$4,000.00");
    await expect(table.getByRole("row").nth(1)).toContainText("$1,000.00");
    await expect(table.getByRole("row").nth(2)).toContainText("Items not from the catalogue");
    await table.getByRole("button", { name: "Kitchen fit-out" }).click();
    await expect(page.getByRole("dialog", { name: "Invoices with Kitchen fit-out" }).getByTestId("analysis-documents").getByRole("row")).toHaveCount(3);
  });
});
