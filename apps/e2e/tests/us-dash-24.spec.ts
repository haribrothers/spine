import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-DASH-24", () => {
  test("Ready to bill: nothing waiting, then approved billable expenses not billed, opening the filtered Expenses list", async ({ page }) => {
    await signUpNewOrg(page, { name: "Billing Owner", email: `e2e-dash-24-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.goto("/dashboard");
    const card = page.getByTestId("ready-to-bill");
    await expect(card).toContainText("Nothing waiting to be billed.");

    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const category = await post<{ id: string }>("/expense-categories", { name: "Materials" });
    for (const [amount, billable, description] of [["50000", true, "Tiles for the lobby"], ["11240", true, "Grout"], ["70000", false, "Office chairs"]] as const) {
      const expense = await post<{ id: string }>("/expenses", { categoryId: category.id, date: today(), currency: "USD", amount, description, isBillable: billable });
      await post(`/expenses/${expense.id}/approve`, {});
    }

    await page.reload();
    await expect(card).toContainText("$612.40");
    await card.getByRole("link", { name: "Approved billable expenses not billed · 2" }).click();
    // US-PUR-42: the Ready to bill card, pressed.
    await expect(page).toHaveURL(/\/expenses\?card=bill$/);
    await expect(page.getByRole("button", { name: "Show ready to bill only" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("table")).toContainText("$500.00");
    await expect(page.getByRole("table")).toContainText("$112.40");
    await expect(page.getByRole("table")).not.toContainText("$700.00");
    await page.getByRole("button", { name: "Show ready to bill only" }).click();
    await expect(page.getByRole("table")).toContainText("$700.00");
  });
});
