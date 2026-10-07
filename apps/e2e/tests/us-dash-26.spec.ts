import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-DASH-26", () => {
  test("Accrual / Cash recomputes Profit this month and the money chart, and the choice is kept", async ({ page }) => {
    await signUpNewOrg(page, { name: "Basis Owner", email: `e2e-dash-26-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const maple = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments" });
    const draft = await post<{ id: string }>("/invoices", { contactId: maple.id, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: "100000", taxRatePercentage: 0 }] });
    const invoice = await post<{ id: string; totalAmount: string }>(`/invoices/${draft.id}/issue`);
    const half = (BigInt(invoice.totalAmount) / 2n).toString();
    await post("/payments", { contactId: maple.id, date: today(), method: "bank_transfer", currency: "USD", amount: half, allocations: [{ invoiceId: invoice.id, amount: half }] });

    await page.goto("/dashboard");
    const basis = page.getByRole("radiogroup", { name: "Profit basis" });
    await expect(basis.getByRole("radio", { name: "Accrual" })).toHaveAttribute("aria-checked", "true");
    const profit = page.locator('[data-kpi="profit"]');
    await expect(profit).toContainText("$1,000.00");
    await expect(profit).not.toContainText("cash basis");
    const chart = page.getByTestId("money-in-out");
    await expect(chart).toContainText("Income and expenses");

    await basis.getByRole("radio", { name: "Cash" }).click();
    await expect(profit).toContainText("$500.00");
    await expect(profit).toContainText("cash basis");
    await expect(chart).toContainText("Money in and out");

    // Kept on the member, so it's there on reload (and on any device).
    await page.reload();
    await expect(page.getByRole("radiogroup", { name: "Profit basis" }).getByRole("radio", { name: "Cash" })).toHaveAttribute("aria-checked", "true");
    await expect(profit).toContainText("cash basis");
  });
});
