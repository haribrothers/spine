import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-RPT-31", () => {
  test("credit notes and vendor credits with applied, refunded and still held", async ({ page }) => {
    await signUpNewOrg(page, { name: "Credits Owner", email: `e2e-rpt-31-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    const maple = await post<{ id: string }>("/contacts", { type: "customer", name: "Maple Ridge Developments" });
    const draft = await post<{ id: string }>("/invoices", { contactId: maple.id, currency: "USD", lines: [{ name: "Fit-out", quantity: 1, unitPriceAmount: "10000" }] });
    const invoice = await post<{ id: string; number: string }>(`/invoices/${draft.id}/issue`);
    await post("/payments", { contactId: maple.id, date: today(), method: "cash", currency: "USD", amount: "10000", allocations: [{ invoiceId: invoice.id, amount: "10000" }] });
    const note = await post<{ id: string }>("/credit-notes", { invoiceId: invoice.id, lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "4000", taxRatePercentage: 0 }] });
    await post(`/credit-notes/${note.id}/issue`);
    await post("/customer-refunds", { sourceCreditNoteId: note.id, amount: "1500", date: today(), method: "bank_transfer", moneyAccountId: bank.id });

    const timber = await post<{ id: string }>("/contacts", { type: "vendor", name: "Coastal Timber Supply" });
    const bill = await post<{ id: string }>("/vendor-bills", { contactId: timber.id, billNumber: "88213", date: today(), currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: "50000", accountId: code("5000") }] });
    await post(`/vendor-bills/${bill.id}/record`);
    const credit = await post<{ id: string }>("/vendor-credits", { contactId: timber.id, billId: bill.id, vendorReference: "CN-4471", date: today(), currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "30000", accountId: code("5000") }] });
    await post(`/vendor-credits/${credit.id}/record`);
    await post(`/vendor-credits/${credit.id}/apply`, { allocations: [{ billId: bill.id, amount: "10000" }] });

    await page.goto("/reports");
    await page.getByRole("main").getByRole("link", { name: "Credit notes and refunds" }).click();
    await expect(page).toHaveURL(/\/reports\/credit-notes-and-refunds$/);
    const cards = page.getByTestId("credits-cards");
    await expect(cards).toContainText("Credited$40.00");
    await expect(cards).toContainText("Refunded$15.00");
    await expect(cards).toContainText("Still held$25.00");
    const row = page.getByTestId("credits-table").getByRole("row", { name: /Maple Ridge Developments/ });
    await expect(row.getByRole("link", { name: invoice.number })).toBeVisible();
    await expect(row).toContainText("$25.00");

    await page.getByRole("tab", { name: "Vendor credits" }).click();
    await expect(page).toHaveURL(/\/reports\/vendor-credits$/);
    const vendorRow = page.getByTestId("credits-table").getByRole("row", { name: /Coastal Timber Supply/ });
    await expect(vendorRow).toContainText("CN-4471");
    await expect(vendorRow.getByRole("link", { name: "88213" })).toHaveAttribute("href", `/vendor-bills/${bill.id}`);
    await expect(vendorRow).toContainText("$100.00");
    await expect(vendorRow).toContainText("$200.00");
  });
});
