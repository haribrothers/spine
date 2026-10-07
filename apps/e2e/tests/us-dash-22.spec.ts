import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-DASH-22", () => {
  test("Top expenses: labelled bars with amount and %, a period choice, a drill-down; none says so", async ({ page }) => {
    await signUpNewOrg(page, { name: "Expenses Owner", email: `e2e-dash-22-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.goto("/dashboard");
    const card = page.getByTestId("top-expenses");
    await expect(card).toContainText("No expenses in this period.");

    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    for (const [accountCode, amount] of [["5000", "300000"], ["6000", "100000"]] as const) {
      await page.request.post(`${API_URL}/bank-transactions`, { headers: { "Idempotency-Key": randomUUID() }, data: { moneyAccountId: bank.id, direction: "out", accountId: code(accountCode), amount, date: today() } });
    }
    await page.reload();
    await expect(card).toContainText("Top expenses · this quarter");
    await expect(card.getByRole("listitem").first()).toContainText("Cost of Materials");
    await expect(card.getByRole("listitem").first()).toContainText("$3,000.00 · 75.0%");
    await expect(card.getByRole("progressbar", { name: "Cost of Materials: 75.0% of expenses" })).toBeVisible();

    await card.getByRole("combobox", { name: "Period" }).click();
    await page.getByRole("option", { name: "This month" }).click();
    await expect(card).toContainText("Top expenses · this month");
    await expect(card).toContainText("Rent");

    await card.getByRole("button", { name: "Rent" }).click();
    await expect(page.getByRole("dialog")).toContainText("6000 — Rent");
  });
});
