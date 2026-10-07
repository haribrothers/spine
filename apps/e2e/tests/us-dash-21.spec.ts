import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-DASH-21", () => {
  test("the Payables card shows current, overdue and total with a bar; Overdue opens Payables filtered to overdue", async ({ page }) => {
    await signUpNewOrg(page, { name: "Payables Owner", email: `e2e-dash-21-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const vendor = await post<{ id: string }>("/contacts", { type: "vendor", name: "Coastal Timber Supply" });
    for (const [billNumber, amount, dueIn] of [["GSC-8834", "107861", -7], ["GSC-8900", "583679", 3]] as const) {
      const bill = await post<{ id: string }>("/vendor-bills", { contactId: vendor.id, billNumber, date: shift(-30), dueDate: shift(dueIn), currency: "USD", lines: [{ type: "item", name: "Timber", quantity: 1, unitPriceAmount: amount, accountId: code("5000") }] });
      await post(`/vendor-bills/${bill.id}/record`);
    }

    await page.goto("/dashboard");
    const card = page.getByTestId("payables-card");
    await expect(card).toContainText("Current$5,836.79");
    await expect(card).toContainText("Overdue$1,078.61");
    await expect(card).toContainText("Total$6,915.40");
    await expect(card.getByTestId("payables-bar")).toHaveAttribute("aria-label", "Current $5,836.79, overdue $1,078.61");
    await expect(card).toContainText("Bills due in the next 7 days1 · $5,836.79");
    await expect(card).toContainText("Oldest overdueGSC-8834 · 7 days");
    // Not a KPI row figure.
    await expect(page.getByTestId("kpi-row")).not.toContainText("Payables");

    await card.getByRole("link", { name: /^Overdue/ }).click();
    await expect(page).toHaveURL(/\/payables\?overdue=1$/);
    await expect(page.getByRole("combobox", { name: "Show" })).toHaveText("Overdue only");
    await expect(page.getByRole("table")).toContainText("GSC-8834");
    await expect(page.getByRole("table")).not.toContainText("GSC-8900");
  });
});
