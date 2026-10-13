import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg } from "./helpers";
import { api, isoDays } from "./quote-seed";

const API_URL = process.env.API_URL ?? "http://localhost:4110";
const toasts = (page: Page) => page.locator('[data-testid="toast"]');

type Account = { id: string; code: string; accountId: string; name: string };

/** A bank account with capital in, a bank charge out, and a cheque not yet on the statement; and a second bank account. */
async function setUp(page: Page, tag: string) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-bank-${tag}-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const accounts = await api<Account[]>(page, "GET", "/money-accounts");
  const bank = accounts.find((a) => a.code === "1010")!;
  const reserve = await api<Account>(page, "POST", "/money-accounts", { kind: "bank", name: "Tax reserve" });
  const ledger = (await api<Record<string, { id: string; code: string }[]>>(page, "GET", "/org/accounts")) as Record<string, { id: string; code: string }[]>;
  const code = (c: string) => Object.values(ledger).flat().find((a) => a.code === c)!.id;
  const money = (direction: "in" | "out", accountCode: string, amount: string, days: number, description: string) =>
    api(page, "POST", "/bank-transactions", { moneyAccountId: bank.id, direction, accountId: code(accountCode), amount, date: isoDays(days), description });
  await money("in", "3000", "1000000", -20, "Capital");
  await money("out", "6900", "2500", -10, "Bank charges");
  await money("out", "6900", "1200", -12, "Cheque to the plumber");
  return { bank, reserve };
}

test.describe("US-BANK-13, US-BANK-15", () => {
  test("accounts on the list layout: tabs, type, the card that filters, and a menu that acts on the account", async ({ page }) => {
    await setUp(page, "13");
    await page.goto("/banking");
    await expect(page.getByRole("tab", { name: "Active, 3" })).toHaveAttribute("aria-selected", "true");
    // The tabs control the list below them (a tab panel), so axe passes.
    await expectNoAxeViolations(page);
    const table = page.getByTestId("money-accounts-table");

    await page.getByRole("combobox", { name: "Filter by type" }).click();
    await page.getByRole("option", { name: "Cash" }).click();
    await expect(page).toHaveURL(/type=cash/);
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table).toContainText("Cash in Hand");
    await page.getByRole("combobox", { name: "Filter by type" }).click();
    await page.getByRole("option", { name: "All types" }).click();

    const card = page.getByRole("button", { name: "Show accounts not yet reconciled only" });
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/card=unreconciled/);
    await expect(table.getByRole("row", { name: /Bank Account/ })).toContainText("3 unreconciled");
    await expect(table.getByRole("row", { name: /Tax reserve/ })).toHaveCount(0);
    await card.click();

    // The row menu, each item with its right; Money out starts from this account.
    await table.getByRole("button", { name: "Actions for Tax reserve" }).click();
    for (const item of ["Open register", "Reconcile", "Import statement", "Money in", "Money out", "Transfer", "Set as default", "Edit", "Archive"]) await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
    await page.getByRole("menuitem", { name: "Money out" }).click();
    await expect(page.getByRole("dialog").getByRole("combobox", { name: "From account" })).toHaveText("Tax reserve");
    await page.keyboard.press("Escape");

    await table.getByRole("button", { name: "Actions for Tax reserve" }).click();
    await page.getByRole("menuitem", { name: "Set as default" }).click();
    await expect(toasts(page).filter({ hasText: "Tax reserve is the default" })).toContainText("New payments use it instead of Bank Account.");
    await expect(table.getByRole("row", { name: /Tax reserve/ })).toContainText("Default");
  });
});

test.describe("US-BANK-14", () => {
  test("the register keeps its range, type and search; entries open their drawer; Export holds what's on screen", async ({ page }) => {
    const { bank } = await setUp(page, "14");
    await page.goto(`/banking/${bank.id}`);
    await page.getByRole("combobox", { name: "Date range" }).click();
    await page.getByRole("option", { name: "Last 90 days" }).click();
    await expect(page).toHaveURL(/range=last_90/);
    await page.getByRole("combobox", { name: "Filter by type" }).click();
    await page.getByRole("option", { name: "Money in and out" }).click();
    await page.getByRole("searchbox", { name: "Search entries" }).fill("capital");
    await expect(page).toHaveURL(/type=money_in_out/);
    await expect(page).toHaveURL(/q=capital/);
    const register = page.getByTestId("register-table");
    await expect(register.getByRole("row")).toHaveCount(2);

    // Export carries the range, type and search.
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const csv = await page.getByTestId("export-csv").getAttribute("href");
    expect(csv).toContain(`/money-accounts/${bank.id}/register?`);
    expect(csv).toContain("type=money_in_out");
    expect(csv).toContain("format=csv");
    expect(csv).toContain("search=capital");
    await page.keyboard.press("Escape");

    // The view survives a reload; a money in entry opens its drawer.
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Filter by type" })).toHaveText("Money in and out");
    await register.getByRole("button", { name: "Money in — Owner's Capital", exact: true }).click();
    const drawer = page.getByTestId("register-entry-drawer");
    await expect(drawer).toContainText("3000 · Owner's Capital");
    await expect(drawer).toContainText("Capital");
    await expect(drawer).toContainText("Not yet");
    await page.keyboard.press("Escape");

    // Record, with this account chosen; the register refreshes.
    await page.getByRole("button", { name: "Record" }).click();
    await page.getByRole("menuitem", { name: "Money in" }).click();
    await expect(page.getByRole("dialog").getByRole("combobox", { name: "Into account" })).toHaveText("Bank Account");
  });
});

test.describe("US-BANK-16, US-BANK-17", () => {
  test("reconcile from the imported statement, match every suggestion at once, then read and download the report", async ({ page }) => {
    const { bank } = await setUp(page, "16");
    const rows = [`${isoDays(-20)},CAPITAL,10000.00,10000.00`, `${isoDays(-10)},BANK CHARGES,-25.00,9975.00`];
    const res = await page.request.post(`${API_URL}/money-accounts/${bank.id}/statement-imports`, {
      headers: { "Idempotency-Key": randomUUID() },
      multipart: {
        file: { name: "e2e-statement.csv", mimeType: "text/csv", buffer: Buffer.from(["Date,Description,Amount,Balance", ...rows].join("\n")) },
        mapping: JSON.stringify({ date: "Date", dateFormat: "YYYY-MM-DD", description: "Description", amountMode: "single", amount: "Amount", balance: "Balance" }),
      },
    });
    expect(res.ok(), await res.text()).toBe(true);

    await page.goto(`/banking/${bank.id}/reconcile`);
    await expect(page.getByTestId("statement-end")).toContainText("From e2e-statement.csv");
    await expect(page.getByRole("textbox", { name: "Closing balance on the statement" })).toHaveValue("$9,975.00");
    await page.getByRole("button", { name: "Start reconciling" }).click();
    await expect(page.getByText("Saved as you go — pick up where you left off.")).toBeVisible();
    await expect(page.getByTestId("reconcile-progress")).toContainText("0 of 2 lines done");
    await expectNoAxeViolations(page);

    // A selected line puts the same amount first.
    await page.getByTestId("statement-line").filter({ hasText: "CAPITAL" }).getByRole("button", { name: "CAPITAL" }).click();
    await expect(page.getByTestId("spine-entry").first()).toContainText("Same amount");
    await page.getByTestId("statement-line").filter({ hasText: "CAPITAL" }).getByRole("button", { name: "CAPITAL" }).click();

    await page.getByRole("button", { name: "Match all suggested (2)" }).click();
    const ask = page.getByRole("alertdialog", { name: "Match 2 suggested lines?" });
    await expect(ask.getByTestId("match-all-pairs")).toContainText("BANK CHARGES");
    await ask.getByRole("button", { name: "Match 2 lines" }).click();
    await expect(toasts(page).filter({ hasText: "2 lines matched" })).toBeVisible();
    await expect(page.getByTestId("reconcile-progress")).toContainText("2 of 2 lines done");
    await expect(page.getByTestId("reconcile-difference")).toContainText("$0.00");
    await page.getByRole("button", { name: "Finish reconciliation" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Finish reconciliation" }).click();

    // The finished reconciliation, read-only, with what's outstanding.
    await page.goto(`/banking/${bank.id}/reconciliations`);
    await page.getByRole("row").nth(1).getByRole("link").click();
    await page.waitForURL(/\/reconciliations\/[0-9a-f-]{36}$/);
    const summary = page.getByTestId("reconciliation-summary");
    await expect(summary).toContainText("Statement closing balance$9,975.00");
    await expect(summary).toContainText("Payments not yet on the statement$12.00");
    await expect(summary).toContainText("$9,963.00");
    await expect(page.getByTestId("reconciliation-outstanding")).toContainText("Money out — Other Expenses");
    await expect(page.getByTestId("reconciliation-matched")).toContainText("BANK CHARGES");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download report" }).click();
    expect((await download).suggestedFilename()).toBe(`reconciliation-bank-account-${isoDays(-10)}.pdf`);
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  });
});
