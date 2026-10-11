import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, isoDays } from "./quote-seed";

async function invoice(page: Page, contactId: string, amount: string, dueDays: number) {
  const draft = await api(page, "POST", "/invoices", { contactId, currency: "USD", dueDate: isoDays(dueDays), lines: [{ type: "item", name: "Site work", quantity: 1, unitPriceAmount: amount }] });
  return api<{ id: string; number: string }>(page, "POST", `/invoices/${draft.id}/issue`, {});
}

async function setUp(page: Page, tag: string) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-pay-${tag}-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const c = await api(page, "POST", "/contacts", { type: "customer", name: "Lakshmi Hospital", email: `accounts-${randomUUID()}@lakshmi.example` });
  const older = await invoice(page, c.id, "100000", -12);
  const newer = await invoice(page, c.id, "50000", 5);
  return { contactId: c.id, older, newer };
}

test.describe("US-PAY-23", () => {
  test("Record payment: tick what it pays, see what becomes credit, land on the payment's page", async ({ page }) => {
    const { older, newer } = await setUp(page, "23");
    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    await dialog.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
    await page.getByRole("option", { name: "Lakshmi Hospital" }).click();

    // Oldest due first, with how late it is; ticking fills the amount.
    const rows = dialog.getByTestId("record-payment-invoice");
    await expect(rows.first()).toContainText(older.number);
    await expect(rows.first()).toContainText("12 days late");
    await dialog.getByRole("checkbox", { name: `Pay ${older.number}` }).check();
    await expect(dialog.getByLabel("Amount", { exact: true })).toHaveValue("1000.00");
    await expect(dialog.getByTestId("record-payment-summary")).toHaveText(`$1,000.00 goes on ${older.number}; nothing becomes credit.`);

    // A typed amount is spread oldest first; the rest becomes credit.
    await dialog.getByLabel("Amount", { exact: true }).fill("1700");
    await expect(dialog.getByLabel(`Amount to pay on ${newer.number}`)).toHaveValue("500.00");
    await expect(dialog.getByTestId("record-payment-summary")).toHaveText("$1,500.00 goes on 2 invoices; $200.00 becomes credit for Lakshmi Hospital.");
    await expect(dialog.getByRole("switch", { name: /Email a receipt to accounts-/ })).toBeChecked();
    await dialog.getByLabel("Reference").fill("Cheque 004512");
    await dialog.getByRole("button", { name: "Record payment" }).click();

    await page.waitForURL(/\/payments\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^RCP-/);
    await expect(page.getByTestId("payment-state")).toHaveText("Credit left");
  });
});

test.describe("US-PAY-19, US-PAY-20, US-PAY-26", () => {
  test("the payment's page: state, strip, Applied to, Activity — and moving it off the wrong invoice", async ({ page }) => {
    const { contactId, older, newer } = await setUp(page, "19");
    const payment = await api<{ id: string; number: string }>(page, "POST", "/payments", {
      contactId,
      date: isoDays(0),
      method: "cheque",
      reference: "Cheque 004512",
      currency: "USD",
      amount: "170000",
      allocations: [
        { invoiceId: older.id, amount: "100000" },
        { invoiceId: newer.id, amount: "50000" },
      ],
    });
    await page.goto(`/payments/${payment.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(payment.number);
    await expect(page.getByTestId("payment-state")).toHaveText("Credit left");
    await expect(page.getByTestId("payment-meta")).toContainText("Cheque 004512");
    await expect(page.getByTestId("fig-received")).toContainText("$1,700.00");
    await expect(page.getByTestId("fig-applied")).toContainText("To 2 invoices");
    await expect(page.getByTestId("fig-left")).toContainText("$200.00");
    await expect(page.getByTestId("payment-actions").getByRole("button", { name: "Apply credit" })).toBeVisible();
    const olderRow = page.getByTestId("applied-to-row").filter({ hasText: older.number });
    await expect(olderRow).toContainText("Paid");
    await expect(page.getByTestId("payment-activity")).toContainText("Recorded · $1,700.00 by cheque");
    await expect(page.getByTestId("payment-activity")).toContainText(`Applied $500.00 to ${newer.number}`);

    // Move off: asks first, with a reason; the money becomes credit.
    await page.getByRole("button", { name: `Actions for ${newer.number}` }).click();
    await page.getByRole("menuitem", { name: `Move off ${newer.number}` }).click();
    const ask = page.getByRole("dialog", { name: `Move $500.00 off ${newer.number}?` });
    await expect(ask).toContainText(`${newer.number} will owe $500.00 again, and $500.00 becomes credit for Lakshmi Hospital`);
    await ask.getByRole("button", { name: "Go back" }).click();
    await expect(page.getByTestId("applied-to-row")).toHaveCount(2);
    await page.getByRole("button", { name: `Actions for ${newer.number}` }).click();
    await page.getByRole("menuitem", { name: `Move off ${newer.number}` }).click();
    await ask.getByLabel("Reason").fill("Belongs on the Wing C invoice");
    await ask.getByRole("button", { name: "Move off invoice" }).click();
    await expect(page.getByText("$500.00 is now credit").first()).toBeVisible();
    await expect(page.getByTestId("applied-to-row")).toHaveCount(1);
    await expect(page.getByTestId("fig-left")).toContainText("$700.00");
    await expect(page.getByTestId("payment-activity")).toContainText(`Moved $500.00 off ${newer.number} · “Belongs on the Wing C invoice”`);

    // The invoice owes it again, and its Payments row links back to the payment.
    await page.goto(`/invoices/${newer.id}`);
    await expect(page.getByTestId("fig-balance")).toContainText("$500.00");
    await page.goto(`/invoices/${older.id}`);
    await page.getByTestId("invoice-payments").getByRole("link", { name: payment.number }).click();
    await expect(page).toHaveURL(new RegExp(`/payments/${payment.id}$`));

    // Old links open the page.
    await page.goto(`/payments?id=${payment.id}`);
    await expect(page).toHaveURL(new RegExp(`/payments/${payment.id}$`));
  });
});

test.describe("US-PAY-21, US-PAY-22, US-PAY-24", () => {
  test("the list: cards, what each payment paid, filters in the address, the row menu, and a duplicate warning", async ({ page }) => {
    const { contactId, older } = await setUp(page, "21");
    const credit = await api<{ id: string; number: string }>(page, "POST", "/payments", { contactId, date: isoDays(0), method: "upi", reference: "UTR 4471 2280", currency: "USD", amount: "45000", allocations: [] });
    const paid = await api<{ id: string; number: string }>(page, "POST", "/payments", { contactId, date: isoDays(0), method: "bank_transfer", currency: "USD", amount: "100000", allocations: [{ invoiceId: older.id, amount: "100000" }] });

    await page.goto("/payments");
    await expect(page.getByTestId("payment-stats")).toContainText("Received this month");
    await expect(page.getByTestId("payment-stats")).toContainText("$1,450.00");
    const creditRow = page.getByRole("row", { name: new RegExp(credit.number) });
    await expect(creditRow).toContainText("UTR 4471 2280");
    await expect(creditRow).toContainText("Not applied");
    await expect(creditRow.getByTestId("payment-credit-left")).toHaveText("$450.00");
    await expect(page.getByRole("row", { name: new RegExp(paid.number) }).getByRole("link", { name: older.number })).toBeVisible();

    // The Credit to use card filters, in the address; search too; Reload keeps both.
    await page.getByRole("button", { name: /Show payments with credit left/ }).click();
    await expect(page).toHaveURL(/card=credit/);
    await expect(page.getByRole("row", { name: new RegExp(paid.number) })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search payments" }).fill("4471");
    await expect(page).toHaveURL(/q=4471/);
    await page.reload();
    await expect(page.getByRole("searchbox", { name: "Search payments" })).toHaveValue("4471");
    await expect(page.getByRole("row", { name: new RegExp(credit.number) })).toBeVisible();

    // The row menu opens the page's dialog rather than acting.
    await page.getByRole("button", { name: `Actions for ${credit.number}` }).click();
    await page.getByRole("menuitem", { name: "Apply credit" }).click();
    await expect(page).toHaveURL(new RegExp(`/payments/${credit.id}$`));
    await expect(page.getByRole("dialog", { name: "Apply credit" })).toBeVisible();
    await page.keyboard.press("Escape");

    // US-PAY-24: the same customer and amount within 3 days looks like a duplicate.
    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    await dialog.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
    await page.getByRole("option", { name: "Lakshmi Hospital" }).click();
    await dialog.getByLabel("Amount", { exact: true }).fill("450");
    await expect(dialog.getByTestId("possible-duplicate")).toContainText(`This looks like ${credit.number}`);
    await expect(dialog.getByTestId("possible-duplicate").getByRole("link", { name: `Open ${credit.number}` })).toBeVisible();
  });
});

test.describe("US-PAY-25", () => {
  test("search finds a payment by its reference and opens it", async ({ page }) => {
    const { contactId } = await setUp(page, "25");
    const p = await api<{ id: string; number: string }>(page, "POST", "/payments", { contactId, date: isoDays(0), method: "upi", reference: "UTR 9081 5530", currency: "USD", amount: "12345", allocations: [] });
    await page.goto("/payments");
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Search" });
    await palette.getByRole("combobox", { name: "Search" }).fill("9081 5530");
    await expect(palette.getByRole("listbox").getByText("Payments", { exact: true })).toBeVisible();
    await palette.getByRole("option", { name: new RegExp(p.number) }).click();
    await expect(page).toHaveURL(new RegExp(`/payments/${p.id}$`));
  });
});
