import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, isoDays } from "./quote-seed";

const toasts = (page: Page) => page.locator('[data-testid="toast"]');
const confirmDialog = (page: Page, name: string | RegExp) => page.getByRole("alertdialog", { name }).or(page.getByRole("dialog", { name }));

async function setUp(page: Page, tag: string) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-vpy-${tag}-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const vendor = await api<{ id: string; name: string }>(page, "POST", "/contacts", { type: "vendor", name: "Ridgeline Equipment Rentals", email: "accounts@ridgeline.example" });
  const bill = async (billNumber: string, amount: string, due: number) => {
    const created = await api<{ id: string }>(page, "POST", "/vendor-bills", {
      contactId: vendor.id,
      billNumber,
      date: isoDays(due - 30),
      dueDate: isoDays(due),
      currency: "USD",
      lines: [{ type: "item", name: "JCB hire", quantity: 1, unitPriceAmount: amount }],
    });
    await api(page, "POST", `/vendor-bills/${created.id}/record`);
    return created;
  };
  return { vendor, bill };
}

test.describe("US-PUR-52, US-PUR-53, US-PUR-49", () => {
  test("pay by ticking bills: oldest due first, a typed amount spreads, the line says what it pays, Record asks first, then the payment's page", async ({ page }) => {
    const { vendor, bill } = await setUp(page, "52");
    await bill("RTE-3340", "23600", 20);
    await bill("RTE-3302", "40000", -12);

    await page.goto("/vendor-payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Record a vendor payment" });
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: vendor.name }).click();

    // Oldest due first, with how late.
    const rows = dialog.getByTestId("vendor-payment-bill");
    await expect(rows.nth(0)).toContainText("RTE-3302");
    await expect(rows.nth(0)).toContainText("12 days late");
    await expect(rows.nth(1)).toContainText("RTE-3340");

    // Ticking takes the balance; a typed amount is spread oldest first.
    await dialog.getByRole("checkbox", { name: "Pay RTE-3302" }).click();
    await expect(dialog.getByTestId("vendor-payment-summary")).toHaveText("$400.00 pays RTE-3302 in full.");
    await dialog.getByRole("textbox", { name: "Amount", exact: true }).fill("480.00");
    await expect(dialog.getByTestId("vendor-payment-summary")).toHaveText("$480.00 pays RTE-3302 in full and $80.00 of RTE-3340.");
    // Lowering a line leaves the amount short, and Record waits.
    await dialog.getByRole("textbox", { name: "Pay on RTE-3340" }).fill("50.00");
    await expect(dialog.getByTestId("vendor-payment-summary")).toContainText("$30.00 more than the ticked bills");
    await expect(dialog.getByRole("button", { name: "Record payment" })).toBeDisabled();
    await dialog.getByRole("textbox", { name: "Pay on RTE-3340" }).fill("80.00");

    await dialog.getByRole("textbox", { name: "Reference" }).fill("NEFT 4471");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    const ask = confirmDialog(page, "Record this payment?");
    await expect(ask).toContainText("It pays RTE-3302 in full and $80.00 of RTE-3340");
    await ask.getByRole("button", { name: "Record payment" }).click();
    await expect(toasts(page).filter({ hasText: "recorded" })).toContainText("It's posted to your books");

    // The payment's page.
    await page.waitForURL(/\/vendor-payments\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^VPY-/);
    await expect(page.getByTestId("vendor-payment-meta")).toContainText("Ridgeline Equipment Rentals");
    await expect(page.getByTestId("vendor-payment-meta")).toContainText("NEFT 4471");
    await expect(page.getByTestId("vendor-payment-figures")).toContainText("$480.00");
    await expect(page.getByTestId("vendor-payment-figures")).toContainText("RTE-3302 in full, part of RTE-3340");
    const paidTo = page.getByTestId("paid-to-row");
    await expect(paidTo.nth(0)).toContainText("Paid");
    await expect(paidTo.nth(1)).toContainText("$156.00");
    const entries = page.getByTestId("vendor-payment-activity-entry");
    await expect(entries.last()).toContainText("Recorded · $480.00 by bank transfer");
    await expect(page.getByTestId("vendor-payment-activity")).toContainText("Paid $80.00 on RTE-3340");

    // The same vendor and amount again is flagged, with a link; it can still be recorded.
    await page.goto("/vendor-payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: vendor.name }).click();
    await dialog.getByRole("textbox", { name: "Amount", exact: true }).fill("480.00");
    await expect(dialog.getByTestId("vendor-payment-duplicate-warning")).toContainText("This looks like VPY-");
    await expect(dialog.getByTestId("vendor-payment-duplicate-warning").getByRole("link")).toHaveAttribute("href", /\/vendor-payments\/[0-9a-f-]{36}$/);
  });
});

test.describe("US-PUR-51, US-PUR-50", () => {
  test("the list shows money and the bills paid; filters stay in the address; Delete asks first and the bills owe again", async ({ page }) => {
    const { vendor, bill } = await setUp(page, "51");
    const rte = await bill("RTE-3302", "40000", -12);
    await api(page, "POST", "/vendor-payments", { contactId: vendor.id, date: isoDays(0), method: "upi", reference: "UPI 2291", currency: "USD", amount: "40000", allocations: [{ billId: rte.id, amount: "40000" }] });
    await bill("RTE-3355", "11800", -3);

    await page.goto("/vendor-payments");
    const stats = page.getByTestId("vendor-payment-stats");
    await expect(stats).toContainText("Paid this month");
    await expect(stats).toContainText("$400.00");
    await expect(stats).toContainText("$118.00");
    await expect(stats).toContainText("1 overdue bill");
    const row = page.getByRole("row").filter({ hasText: "UPI 2291" });
    await expect(row).toContainText("RTE-3302");
    await expect(row).toContainText("UPI");

    // Method filter and search in the address.
    await page.getByRole("combobox", { name: "Filter by method" }).click();
    await page.getByRole("option", { name: "Cash" }).click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/method=cash/);
    await expect(page.getByText("No vendor payments match these filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await page.getByRole("textbox", { name: "Search vendor payments" }).fill("rte-3302");
    await expect(page).toHaveURL(/q=rte-3302/);
    await expect(row).toBeVisible();

    // Row menu with icons; Delete opens the page and asks first, naming the bill.
    await page.getByRole("button", { name: /^Actions for VPY-/ }).click();
    for (const item of ["View", "Download remittance advice", "Email remittance advice", "Delete payment"]) await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
    await page.getByRole("menuitem", { name: "Delete payment" }).click();
    const ask = confirmDialog(page, /^Delete VPY-/);
    await expect(ask).toContainText("RTE-3302 will owe $400.00 again");
    await ask.getByRole("button", { name: "Delete payment" }).click();
    await expect(toasts(page).filter({ hasText: "deleted" })).toContainText("The bills it paid owe again");
    await page.waitForURL(/\/vendor-payments$/);

    await page.goto(`/vendor-bills/${rte.id}`);
    await expect(page.getByTestId("bill-state")).not.toHaveText("Paid");
    await expect(page.getByTestId("bill-activity")).toContainText(/Payment VPY-\d+ deleted · owes \$400\.00 again/);
  });
});

test.describe("US-PUR-54, US-PUR-55", () => {
  test("the remittance advice downloads and emails the vendor; search finds the payment", async ({ page }) => {
    const { vendor, bill } = await setUp(page, "54");
    const rte = await bill("RTE-3302", "40000", -12);
    const payment = await api<{ id: string; number: string }>(page, "POST", "/vendor-payments", { contactId: vendor.id, date: isoDays(0), method: "bank_transfer", reference: "NEFT 4471", currency: "USD", amount: "40000", allocations: [{ billId: rte.id, amount: "40000" }] });

    await page.goto(`/vendor-payments/${payment.id}`);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download remittance advice" }).click();
    expect((await download).suggestedFilename()).toBe(`remittance-${payment.number}.pdf`);

    await page.getByTestId("vendor-payment-actions").getByRole("button", { name: "Email remittance advice" }).click();
    const mail = page.getByRole("dialog", { name: "Email remittance advice" });
    await expect(mail.getByRole("textbox", { name: "To" })).toHaveValue("accounts@ridgeline.example");
    await expect(mail.getByRole("textbox", { name: "Subject" })).toHaveValue(new RegExp(`Remittance advice — ${payment.number}`));
    await expect(mail.getByRole("textbox", { name: "Message" })).toHaveValue(/against your RTE-3302/);
    await expect(mail.getByTestId("remittance-attachment")).toHaveText(`remittance-${payment.number}.pdf`);
    await mail.getByRole("button", { name: "Send" }).click();
    await expect(toasts(page).filter({ hasText: "Remittance advice sent" })).toContainText("accounts@ridgeline.example");
    await expect(page.getByTestId("vendor-payment-activity")).toContainText("Remittance advice emailed to accounts@ridgeline.example");

    // ⌘K finds it by number.
    await page.keyboard.press("ControlOrMeta+k");
    const search = page.getByRole("dialog", { name: "Search" });
    await search.getByRole("combobox", { name: "Search" }).fill(payment.number);
    await expect(search.getByText("Vendor payments", { exact: true })).toBeVisible();
    await search.getByRole("option", { name: new RegExp(payment.number) }).first().click();
    await page.waitForURL(new RegExp(`/vendor-payments/${payment.id}$`));
  });
});
