import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-RPT-27", () => {
  test("Profit & Loss compared with the previous period, last year and each month; Balance Sheet against the previous year end", async ({ page }) => {
    await signUpNewOrg(page, { name: "Compare Owner", email: `e2e-rpt-27-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    const year = new Date().getFullYear();
    for (const [accountCode, amount, date] of [
      ["4100", "300000", `${year - 1}-01-01`],
      ["4100", "400000", `${year}-01-01`],
      ["4100", "500000", `${year}-01-01`],
    ] as const) {
      await page.request.post(`${API_URL}/bank-transactions`, { headers: { "Idempotency-Key": randomUUID() }, data: { moneyAccountId: bank.id, direction: "in", accountId: code(accountCode), amount, date } });
    }

    await page.goto("/reports/profit-and-loss");
    await page.getByRole("combobox", { name: "Compare with" }).click();
    await page.getByRole("option", { name: "Previous period" }).click();
    const table = page.getByTestId("pl-compare-table");
    await expect(table.getByRole("columnheader", { name: "Change %" })).toBeVisible();
    await expect(page.getByTestId("pl-compare-subtitle")).toContainText("compared with");

    await page.getByRole("combobox", { name: "Compare with" }).click();
    await page.getByRole("option", { name: "Same period last year" }).click();
    await expect(page.getByTestId("pl-compare-subtitle")).toContainText(`${year - 1}`);
    const sales = table.getByRole("row", { name: /4100 · Sales — Services/ });
    // Jan 1 last year 3,000 against Jan 1 this year 9,000 (the range starts on Jan 1): ▲ +6,000, ▲ +200%.
    await expect(sales).toContainText("$9,000.00");
    await expect(sales).toContainText("$3,000.00");
    await expect(sales).toContainText("▲ +$6,000.00");
    await expect(sales).toContainText("▲ +200.0%");
    await expect(page.getByText("▲ 200.0% vs last year").first()).toBeVisible();

    await page.getByRole("combobox", { name: "Compare with" }).click();
    await page.getByRole("option", { name: "Each month" }).click();
    await expect(table.getByRole("columnheader", { name: `Jan ${year}` })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Total" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Change" })).toHaveCount(0);

    await page.goto("/reports/balance-sheet");
    await page.getByRole("combobox", { name: "Compare with" }).click();
    await page.getByRole("option", { name: "Previous year end" }).click();
    const bs = page.getByTestId("bs-compare-table");
    await expect(bs.getByRole("columnheader", { name: `Dec 31, ${year - 1}` })).toBeVisible();
    await expect(bs.getByRole("row", { name: /Total assets/ })).toContainText("$12,000.00");
    await expect(bs.getByRole("row", { name: /Total assets/ })).toContainText("$3,000.00");
  });
});
