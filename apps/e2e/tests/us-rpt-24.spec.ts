import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { test as seeded, logIn } from "./fixtures";
import { test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-RPT-24", () => {
  test("opening balance, entries with a running balance, closing balance; pick accounts; a row opens its document", async ({ page }) => {
    await signUpNewOrg(page, { name: "Ledger Owner", email: `e2e-rpt-24-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const ids: string[] = [];
    for (const [date, reason, amount] of [["2026-01-15", "Year-end accruals", "482000"], [today(), "Depreciation this month", "105000"]] as const) {
      const res = await page.request.post(`${API_URL}/manual-journals`, {
        headers: { "Idempotency-Key": randomUUID() },
        data: { date, reason, lines: [{ accountId: code("6900"), debit: amount, credit: "0" }, { accountId: code("1510"), debit: "0", credit: amount }] },
      });
      ids.push(((await res.json()) as { id: string }).id);
    }

    await page.goto("/reports");
    await page.getByRole("link", { name: "General ledger" }).click();
    await expect(page).toHaveURL(/\/reports\/general-ledger$/);
    await expect(page.getByRole("heading", { name: "General ledger", level: 1 })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Hide accounts with no activity" })).toBeChecked();

    const expense = page.getByTestId("gl-account-6900");
    await expect(expense).toContainText("Opening balance $4,820.00 Dr");
    await expect(expense).toContainText("Depreciation this month");
    await expect(expense.getByTestId("gl-closing")).toHaveText("$5,870.00 Dr");
    await expect(page.getByTestId("gl-account-1510").getByTestId("gl-closing")).toHaveText("$5,870.00 Cr");
    await expect(page.getByText("1–2 of 2")).toBeVisible();

    await page.getByRole("combobox", { name: "Accounts" }).click();
    await page.getByRole("option", { name: /^6900/ }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("gl-account-1510")).toHaveCount(0);
    await expect(page.getByTestId("gl-account-6900")).toBeVisible();

    await page.getByTestId("gl-account-6900").getByRole("link", { name: "Journal JNL-0002" }).click();
    await expect(page).toHaveURL(new RegExp(`/journals/${ids[1]}$`));
    await expect(page.getByRole("heading", { name: "JNL-0002" })).toBeVisible();
  });
});

seeded.describe("US-RPT-24 access", () => {
  seeded("Staff without 'View ledger / journals' see the no-access page and the API refuses", async ({ page: _, seededOrg: __, browser }) => {
    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto("/reports/general-ledger");
    await expect(staff.getByRole("heading", { name: /You don't have access to/ })).toBeVisible();
    expect((await staff.request.get(`${API_URL}/reports/general-ledger?from=2026-07-01&to=2026-09-30`)).status()).toBe(403);
    await context.close();
  });
});
