import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-RPT-35", () => {
  test("Basis → Cash counts what customers paid; opening invoices are noted; other statements have no switch", async ({ page }) => {
    await signUpNewOrg(page, { name: "Cash Basis Owner", email: `e2e-rpt-35-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown, method: "post" | "put" = "post") => (await (await page.request[method](`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const year = new Date().getFullYear();
    const maple = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments" });
    await post("/opening-balances", { cutoverDate: `${year}-01-01`, lines: [] }, "put");
    const opening = await post<{ id: string }>("/opening-balances/invoices", { contactId: maple.id, number: "RB-2291", invoiceDate: `${year - 1}-11-28`, dueDate: `${year - 1}-12-28`, amountDue: "875000" });
    await post("/payments", { contactId: maple.id, date: today(), method: "bank_transfer", currency: "USD", amount: "875000", allocations: [{ invoiceId: opening.id, amount: "875000" }] });
    const draft = await post<{ id: string }>("/invoices", { contactId: maple.id, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: "100000", taxRatePercentage: 0 }] });
    const invoice = await post<{ id: string; totalAmount: string }>(`/invoices/${draft.id}/issue`);
    const half = (BigInt(invoice.totalAmount) / 2n).toString();
    await post("/payments", { contactId: maple.id, date: today(), method: "bank_transfer", currency: "USD", amount: half, allocations: [{ invoiceId: invoice.id, amount: half }] });

    await page.goto("/reports/profit-and-loss");
    await expect(page.getByRole("radio", { name: "Accrual" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Cash" }).click();
    const view = page.getByTestId("cash-basis");
    await expect(view.getByTestId("pl-basis-subtitle")).toContainText("· Cash basis");
    await expect(view).toContainText("Cash received (income)$500.00");
    await expect(view).toContainText("accrual basis: $1,000.00");
    await expect(view.getByTestId("cash-basis-table").getByRole("row", { name: /4100 · Sales — Services/ })).toContainText("$500.00");
    await expect(view).toContainText(`Payments on invoices from before Jan 1, ${year} aren't counted — that income was in your old books.`);
    await expect(page.getByRole("link", { name: "Export CSV" })).toHaveAttribute("href", /basis=cash/);

    for (const report of ["balance-sheet", "trial-balance", "tax-summary"]) {
      await page.goto(`/reports/${report}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Basis", { exact: true })).toHaveCount(0);
    }
  });
});
