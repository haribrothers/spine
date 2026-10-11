import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, isoDays } from "./quote-seed";
import { test as seededTest } from "./fixtures";

async function invoice(page: Page, contactId: string, amount: string, dueDays: number) {
  const draft = await api(page, "POST", "/invoices", { contactId, currency: "USD", dueDate: isoDays(dueDays), lines: [{ type: "item", name: "Site work", quantity: 1, unitPriceAmount: amount }] });
  return api<{ id: string; number: string }>(page, "POST", `/invoices/${draft.id}/issue`, {});
}

/** Halcyon (with an email) owes 1,000.00 forty days late and 500.00 not yet due, with 200.00 credit; Karthik (no email) owes 300.00 ten days late. */
async function setUp(page: Page, tag: string) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-pay-${tag}-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const halcyon = await api(page, "POST", "/contacts", { type: "customer", name: "Halcyon Tech Parks", email: `accounts-${randomUUID()}@halcyon.example` });
  const karthik = await api(page, "POST", "/contacts", { type: "customer", name: "Karthik Subramanian" });
  const late = await invoice(page, halcyon.id, "100000", -40);
  const soon = await invoice(page, halcyon.id, "50000", 5);
  const karthikLate = await invoice(page, karthik.id, "30000", -10);
  await api(page, "POST", "/payments", { contactId: halcyon.id, date: isoDays(0), method: "bank_transfer", currency: "USD", amount: "20000", allocations: [], sendReceipt: false });
  return { halcyon, karthik, late, soon, karthikLate };
}

const rowOf = (page: Page, text: string | RegExp) => page.getByRole("row").filter({ hasText: text });

test.describe("US-PAY-27, US-PAY-31", () => {
  test("By customer: who owes most, their credit and last reminder, each opening onto its invoices; the page keeps its place", async ({ page }) => {
    const { late, soon } = await setUp(page, "27");
    await page.goto("/receivables");
    await expect(page.getByText(/What customers owe you, by how late it is · as of .*\d{4}/)).toBeVisible();
    await expect(page.getByRole("tab", { name: "By customer, 2" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "By invoice, 3" })).toBeVisible();

    // Most overdue money first; Halcyon's figures; a totals row.
    const halcyon = rowOf(page, "Halcyon Tech Parks");
    await expect(page.getByRole("row").nth(1)).toContainText("Halcyon Tech Parks");
    for (const text of ["2 invoices", "40 days late", "$1,000.00", "$1,500.00", "$200.00", "Never"]) await expect(halcyon).toContainText(text);
    await expect(rowOf(page, "Karthik Subramanian")).toContainText("10 days late");
    await expect(page.locator("tfoot")).toContainText("2 customers");
    await expect(page.locator("tfoot")).toContainText("$1,300.00");

    // Opening a customer shows their invoices, oldest due first.
    await page.getByRole("button", { name: "Show Halcyon Tech Parks's invoices" }).click();
    const opened = page.getByTestId("customer-invoices");
    await expect(opened.getByRole("link")).toHaveText([late.number, soon.number]);
    await expect(opened).toContainText("40 days late");
    await expect(opened).toContainText("Due in 5 days");

    // Search narrows to the customer, in the address.
    await page.getByRole("searchbox", { name: "Search receivables" }).fill("karth");
    await expect(page).toHaveURL(/q=karth/);
    await expect(page.getByRole("row").filter({ hasText: "Halcyon" })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search receivables" }).fill("");

    // Tab and age in the address; an invoice and Back bring the same page.
    await page.getByRole("tab", { name: /By invoice/ }).click();
    await page.getByRole("button", { name: "Show overdue only" }).click();
    await expect(page).toHaveURL(/view=invoices&age=overdue/);
    await page.getByRole("link", { name: late.number }).click();
    await page.waitForURL(`**/invoices/${late.id}`);
    await page.goBack();
    await expect(page.getByRole("tab", { name: /By invoice/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Show overdue only" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("receivables-updated")).toHaveText("Updated just now");
  });
});

test.describe("US-PAY-28, US-PAY-29, US-PAY-30", () => {
  test("By invoice: filter by age, read each row, act from it and remind several at once", async ({ page }) => {
    const { late, karthikLate } = await setUp(page, "28");
    await page.goto("/receivables?view=invoices");
    await expect(page.getByRole("row")).toHaveCount(4); // heading + 3

    // US-PAY-30: how late in words, the last reminder, optional columns.
    const lateRow = rowOf(page, late.number);
    await expect(lateRow).toContainText("31–60 days");
    await expect(lateRow).toContainText("40 days late");
    await expect(lateRow.getByTestId("receivable-reminded")).toHaveText("Never reminded");
    await expect(page.getByRole("columnheader", { name: "Issued" })).toHaveCount(0);
    await page.getByRole("button", { name: "Columns" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Paid so far" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("columnheader", { name: /Paid so far/ })).toBeVisible();

    // US-PAY-29: a card, a part of the bar and the filter narrow the list; the cards keep every age.
    await page.getByRole("button", { name: "Show overdue only" }).click();
    await expect(page.getByRole("row")).toHaveCount(3);
    await page.getByTestId("aging-chart").getByRole("button", { name: /1–30 days/ }).click();
    await expect(page).toHaveURL(/age=0-30/);
    await expect(page.getByRole("combobox", { name: "Show by age" })).toHaveText("1–30 days");
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByTestId("aging-cards")).toContainText("$1,800.00");
    await page.getByRole("combobox", { name: "Show by age" }).click();
    await page.getByRole("option", { name: "90+ days" }).click();
    await expect(page.getByText("Nothing 90+ days late.")).toBeVisible();
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(page.getByRole("row")).toHaveCount(4);

    // US-PAY-28: Send reminder says why it can't go; others act through their dialogs.
    await page.getByRole("button", { name: `Actions for ${karthikLate.number}` }).click();
    const remind = page.getByRole("menuitem", { name: /Send reminder/ });
    await expect(remind).toHaveAttribute("aria-disabled", "true");
    await expect(remind).toContainText("The customer has no email address.");
    await expect(page.getByRole("menuitem", { name: "Apply credit" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: `Actions for ${late.number}` }).click();
    await expect(page.getByRole("menuitem", { name: "Apply credit" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Record payment" }).click();
    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    await expect(dialog.getByRole("checkbox", { name: `Pay ${late.number}` })).toBeChecked();
    await dialog.getByLabel("Amount", { exact: true }).fill("400");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(page.locator('[data-testid="toast"]').filter({ hasText: /RCP-\d+ recorded/ })).toBeVisible();
    await expect(page).toHaveURL(/\/receivables\?view=invoices/);
    await expect(rowOf(page, late.number)).toContainText("$600.00");

    // Ticked invoices: Send reminders asks first, naming what it skips.
    await page.getByRole("checkbox", { name: `Select ${late.number}` }).check();
    await page.getByRole("checkbox", { name: `Select ${karthikLate.number}` }).check();
    const bar = page.getByRole("region", { name: "Selected invoices" });
    await expect(bar).toContainText("2 selected");
    await bar.getByRole("button", { name: "Send reminders (1)" }).click();
    const ask = page.getByRole("alertdialog", { name: "Send 1 payment reminder?" });
    await expect(ask.getByTestId("confirm-reminders")).toContainText(`${karthikLate.number} — the customer has no email address`);
    await ask.getByRole("button", { name: "Send reminder" }).click();
    await expect(page.locator('[data-testid="toast"]').filter({ hasText: "1 reminder sent" })).toBeVisible();
    await expect(bar).toHaveCount(0);
    await expect(rowOf(page, late.number).getByTestId("receivable-reminded")).toHaveText(/^Last reminded /);
  });
});

seededTest.describe("US-PAY-31", () => {
  seededTest("retention held on jobs is a note under the age bar, never in the aging", async ({ page, seededOrg }) => {
    void seededOrg;
    const retention = await api<{ total: string; jobCount: number }>(page, "GET", "/dashboard/retention");
    await page.goto("/receivables");
    const note = page.getByTestId("retention-note");
    if (BigInt(retention.total) > 0n) {
      await expect(note).toContainText(`retention held on ${retention.jobCount} ${retention.jobCount === 1 ? "job" : "jobs"} isn't counted here`);
      await expect(note.getByRole("link", { name: "See jobs" })).toHaveAttribute("href", "/jobs");
    } else {
      await expect(note).toHaveCount(0);
    }
  });
});
