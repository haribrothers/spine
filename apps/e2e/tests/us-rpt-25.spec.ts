import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-RPT-25", () => {
  test("today's entries with their lines; filter by source; an entry opens its document", async ({ page }) => {
    await signUpNewOrg(page, { name: "Day Book Owner", email: `e2e-rpt-25-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    await page.request.post(`${API_URL}/bank-transactions`, { headers: { "Idempotency-Key": randomUUID() }, data: { moneyAccountId: bank.id, direction: "in", accountId: code("3000"), amount: "1000000", date: today() } });
    const res = await page.request.post(`${API_URL}/manual-journals`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { date: today(), reason: "Depreciation for September", lines: [{ accountId: code("6900"), debit: "65000", credit: "0" }, { accountId: code("1510"), debit: "0", credit: "65000" }] },
    });
    const journal = (await res.json()) as { id: string; number: string };

    await page.goto("/reports");
    await page.getByRole("link", { name: "Day book" }).click();
    await expect(page).toHaveURL(/\/reports\/day-book$/);
    const table = page.getByTestId("day-book-table");
    await expect(page.getByTestId("day-book-entry")).toHaveCount(2);
    await expect(table).toContainText("Money in");
    await expect(table).toContainText(`Journal ${journal.number}`);
    await expect(table).toContainText("Depreciation for September");
    await expect(table).toContainText("6900 · ");
    await expect(page.getByTestId("day-book-total-debit")).toHaveText("$10,650.00");
    await expect(page.getByTestId("day-book-total-credit")).toHaveText("$10,650.00");

    await page.getByRole("combobox", { name: "Source" }).click();
    await page.getByRole("option", { name: "Journals" }).click();
    await expect(page.getByTestId("day-book-entry")).toHaveCount(1);
    await expect(table).not.toContainText("Money in");

    await page.getByRole("combobox", { name: "Source" }).click();
    await page.getByRole("option", { name: "All sources" }).click();
    await expect(page.getByTestId("day-book-entry")).toHaveCount(2);
    await page.getByRole("textbox", { name: "Search entries" }).fill("depreciation");
    await expect(page.getByTestId("day-book-entry")).toHaveCount(1);

    await table.getByRole("link", { name: `Journal ${journal.number}` }).click();
    await expect(page).toHaveURL(new RegExp(`/journals/${journal.id}$`));
  });
});
