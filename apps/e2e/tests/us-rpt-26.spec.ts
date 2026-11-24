import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { test as seeded, logIn } from "./fixtures";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-RPT-26", () => {
  test("cash at start, the three sections, net change, cash at end and a drill-down", async ({ page }) => {
    await signUpNewOrg(page, { name: "Cash Owner", email: `e2e-rpt-26-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    const money = (direction: "in" | "out", accountCode: string, amount: string, date: string) =>
      page.request.post(`${API_URL}/bank-transactions`, { headers: { "Idempotency-Key": randomUUID() }, data: { moneyAccountId: bank.id, direction, accountId: code(accountCode), amount, date } });
    await money("in", "3000", "2000000", "2026-01-15");
    await money("out", "1500", "480000", today());
    await money("in", "4100", "100000", today());

    await page.goto("/reports");
    await page.getByRole("link", { name: "Cash Flow" }).click();
    await expect(page).toHaveURL(/\/reports\/cash-flow$/);
    const cards = page.getByTestId("cash-flow-cards");
    await expect(cards).toContainText("Cash at start$20,000.00");
    await expect(cards).toContainText("Net change−$3,800.00");
    await expect(cards).toContainText("less cash than at the start");
    await expect(cards).toContainText("Cash at end$16,200.00");
    await expect(page.getByTestId("cash-flow-total-operating")).toContainText("Net cash from operating activities$1,000.00");
    await expect(page.getByTestId("cash-flow-total-investing")).toContainText("Net cash from investing activities−$4,800.00");
    await expect(page.getByTestId("cash-flow-total-financing")).toContainText("Net cash from financing activities$0.00");
    await expect(page.getByTestId("cash-flow-check")).toContainText("Cash at end equals the total of your bank and cash accounts on");

    await page.getByRole("button", { name: "Fixed Assets" }).click();
    const dialog = page.getByRole("dialog", { name: "Fixed Assets" });
    await expect(dialog.getByTestId("cash-flow-drilldown")).toContainText("1500 · Fixed Assets");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

seeded.describe("US-RPT-26 access", () => {
  seeded("Staff without 'View financial statements' see the no-access page and the API refuses", async ({ page: _, seededOrg: __, browser }) => {
    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto("/reports/cash-flow");
    await expect(staff.getByRole("heading", { name: /You don't have access to/ })).toBeVisible();
    expect((await staff.request.get(`${API_URL}/reports/cash-flow?from=2026-07-01&to=2026-09-30`)).status()).toBe(403);
    await context.close();
  });
});
