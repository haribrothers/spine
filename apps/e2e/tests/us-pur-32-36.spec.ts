import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, isoDays } from "./quote-seed";

const toasts = (page: Page) => page.locator('[data-testid="toast"]');

async function setUp(page: Page, tag: string) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-pur-${tag}-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const vendor = await api(page, "POST", "/contacts", { type: "vendor", name: "Ridgeline Equipment Rentals" });
  const bill = async (billNumber: string, amount: string, date: number, due: number | null, record = true) => {
    const created = await api<{ id: string }>(page, "POST", "/vendor-bills", {
      contactId: vendor.id,
      billNumber,
      date: isoDays(date),
      dueDate: due === null ? null : isoDays(due),
      currency: "USD",
      lines: [{ type: "item", name: "JCB hire", quantity: 1, unitPriceAmount: amount }],
    });
    if (record) await api(page, "POST", `/vendor-bills/${created.id}/record`);
    return created;
  };
  return { vendor, bill };
}

test.describe("US-PUR-32, US-PUR-33", () => {
  test("a bill's page says where it stands, pays from the page, applies credit and voids with a reason", async ({ page }) => {
    const { vendor, bill } = await setUp(page, "32");
    const rte = await bill("RTE-3302", "100000", -16, 4);
    await api(page, "POST", "/vendor-payments", { contactId: vendor.id, date: isoDays(-9), method: "bank_transfer", currency: "USD", amount: "60000", allocations: [{ billId: rte.id, amount: "60000" }] });
    const credit = await api<{ id: string }>(page, "POST", "/vendor-credits", { contactId: vendor.id, vendorReference: "CN-77", date: isoDays(-2), currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "10000" }] });
    await api(page, "POST", `/vendor-credits/${credit.id}/record`);

    await page.goto(`/vendor-bills/${rte.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("RTE-3302");
    await expect(page.getByTestId("bill-state")).toHaveText("Partly paid");
    await expect(page.getByTestId("bill-meta")).toContainText("Due in 4 days");
    await expect(page.getByTestId("fig-paid")).toContainText("$600.00");
    await expect(page.getByTestId("fig-balance")).toContainText("$400.00");
    await expect(page.getByTestId("fig-credited")).toContainText("$100.00 credit to use");
    await expect(page.getByTestId("bill-activity-entry")).toHaveCount(3);
    await expect(page.getByTestId("bill-activity-entry").first()).toContainText("Paid $600.00 by");
    await expect(page.getByTestId("bill-payment-row").getByRole("link")).toHaveAttribute("href", /\/vendor-payments\?id=[0-9a-f-]{36}$/);

    // Apply credit: the vendor's credit, up to the balance.
    await page.getByRole("button", { name: "Apply credit" }).click();
    const apply = page.getByRole("dialog", { name: "Apply credit to RTE-3302" });
    await apply.getByRole("button", { name: "Apply $100.00" }).click();
    await expect(toasts(page).filter({ hasText: "Credit applied" })).toContainText("$100.00 now counts against RTE-3302.");
    await expect(page.getByTestId("fig-balance")).toContainText("$300.00");
    await expect(page.getByRole("button", { name: "Apply credit" })).toHaveCount(0);

    // Pay bill: the vendor payment dialog with this bill ticked for its balance.
    await page.getByRole("button", { name: "Pay bill" }).click();
    const pay = page.getByRole("dialog", { name: "Record a vendor payment" });
    await expect(pay.getByText("Remaining to allocate: $0.00")).toBeVisible();
    await expect(pay).toContainText("RTE-3302");
    await pay.getByRole("button", { name: "Record payment" }).click();
    await expect(toasts(page).filter({ hasText: /recorded/ })).toContainText("RTE-3302's balance has been updated.");
    await expect(page.getByTestId("bill-state")).toHaveText("Paid");
    await expect(page.getByRole("button", { name: "Pay bill" })).toHaveCount(0);

    // Void, from More: asks first, needs a reason.
    const other = await bill("RTE-3310", "50000", -3, 27);
    await page.goto(`/vendor-bills/${other.id}`);
    await expect(page.getByTestId("bill-state")).toHaveText("Unpaid");
    await page.getByRole("button", { name: "More" }).click();
    for (const item of ["View history", "Make recurring", "Duplicate", "Void bill"]) await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
    await page.getByRole("menuitem", { name: "Void bill" }).click();
    const voidIt = page.getByRole("dialog", { name: "Void RTE-3310?" });
    await voidIt.getByRole("button", { name: "Void bill" }).click();
    await expect(voidIt).toContainText("Give a reason for voiding this bill.");
    await voidIt.getByLabel(/Reason/).fill("Entered twice");
    await voidIt.getByRole("button", { name: "Void bill" }).click();
    await expect(toasts(page).filter({ hasText: "RTE-3310 voided" })).toBeVisible();
    await expect(page.getByTestId("bill-state")).toHaveText("Void");
    await expect(page.getByTestId("fig-balance")).toContainText("—");
    await expect(page.getByTestId("bill-activity-entry").first()).toContainText("Voided · “Entered twice”");
  });
});

test.describe("US-PUR-34, US-PUR-36", () => {
  test("the list shows money and state; the cards filter; ticked drafts record together", async ({ page }) => {
    const { bill } = await setUp(page, "34");
    await bill("CSW-5502", "41064", -60, -30);
    await bill("RTE-3302", "11564", -16, 4);
    await bill("ABM-20587", "18054", -10, 20);
    const voided = await bill("RPH-8834", "7788", -90, -60);
    await api(page, "POST", `/vendor-bills/${voided.id}/void`, { reason: "Wrong vendor" });
    await bill("CSW-5611", "26432", -3, 27, false);
    await bill("KSE-771", "4248", -2, 28, false);

    await page.goto("/vendor-bills");
    const stats = page.getByTestId("bill-stats");
    await expect(stats).toContainText("To pay");
    await expect(stats).toContainText("$706.82");
    await expect(stats).toContainText("3 bills recorded and owed");
    // Newest first; state in words; how late; a void bill's balance is "—".
    await expect(page.getByRole("row").nth(1)).toContainText("KSE-771");
    await expect(page.getByRole("row").filter({ hasText: "CSW-5502" })).toContainText("Overdue");
    await expect(page.getByRole("row").filter({ hasText: "CSW-5502" })).toContainText("30 days late");
    await expect(page.getByRole("row").filter({ hasText: "RPH-8834" }).getByTestId("bill-row-state")).toHaveText("Void");
    await expect(page.getByRole("row").filter({ hasText: "RPH-8834" })).toContainText("—");

    // A card filters, in the address; pressing again clears.
    await page.getByRole("button", { name: "Show overdue only" }).click();
    await expect(page).toHaveURL(/card=overdue/);
    await expect(page.getByRole("row")).toHaveCount(2);
    await page.getByRole("button", { name: "Show overdue only" }).click();
    await expect(page.getByRole("row")).toHaveCount(7);

    // Row menu, with its icons and rights.
    await page.getByRole("button", { name: "Actions for CSW-5502" }).click();
    for (const item of ["View", "Pay bill", "Duplicate", "Void"]) await expect(page.getByRole("menuitem", { name: item, exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Drafts: tick them, Record (2) asks first, then records both.
    await page.getByRole("button", { name: "Show drafts to record only" }).click();
    await page.getByRole("checkbox", { name: "Select every row on this page" }).check();
    const bar = page.getByRole("region", { name: "Selected bills" });
    await bar.getByRole("button", { name: "Record (2)" }).click();
    const ask = page.getByRole("alertdialog", { name: "Record 2 bills?" });
    await expect(ask.getByTestId("confirm-record")).toContainText("$306.80 in all");
    await ask.getByRole("button", { name: "Record bills" }).click();
    await expect(toasts(page).filter({ hasText: "2 bills recorded" })).toBeVisible();
    await expect(page.getByText("No vendor bills match these filters")).toBeVisible();
    await page.getByRole("button", { name: "Show drafts to record only" }).click();
    await expect(page.getByRole("row").filter({ hasText: "KSE-771" })).toContainText("Unpaid");
  });
});

test.describe("US-PUR-35", () => {
  test("Duplicate fills a new bill; the same number warns; the due date is suggested; Save and record asks first", async ({ page }) => {
    const { bill } = await setUp(page, "35");
    const last = await bill("ABM-20587", "18054", -10, 20);

    await page.goto(`/vendor-bills/${last.id}`);
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await page.waitForURL(/\/vendor-bills\/new\?from=/);
    await expect(page.getByRole("combobox", { name: "Item" }).first()).toHaveValue("JCB hire");
    await expect(page.getByPlaceholder("e.g. INV-1042")).toHaveValue("");
    await expect(page.getByText("Suggested: 30 days, as on this vendor's last bill")).toBeVisible();
    await expect(page.getByRole("group", { name: "Due in" }).getByRole("button", { name: "+30 days" })).toHaveAttribute("aria-pressed", "true");

    // The invoice builder's layout: compact rows with Account, item lines only, the bar at the bottom.
    await expect(page.getByRole("combobox", { name: "Account" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add heading" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add text line" })).toHaveCount(0);
    await expect(page.getByTestId("bill-builder-bar")).toContainText("$180.54");

    await page.getByPlaceholder("e.g. INV-1042").fill(" abm-20587 ");
    const warning = page.getByTestId("bill-duplicate-warning");
    await expect(warning).toContainText("Ridgeline Equipment Rentals already has bill ABM-20587");
    await expect(warning.getByRole("link", { name: "Open ABM-20587" })).toHaveAttribute("href", `/vendor-bills/${last.id}`);
    await page.getByPlaceholder("e.g. INV-1042").fill("ABM-20601");
    await expect(warning).toHaveCount(0);

    // Leaving with changes asks first.
    await expect(page.getByTestId("bill-unsaved")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    const leave = page.getByRole("alertdialog", { name: "Leave without saving?" });
    await expect(leave).toContainText("Your changes to this bill will be lost.");
    await leave.getByRole("button", { name: "Keep editing" }).click();

    await page.getByRole("button", { name: "Save and record" }).click();
    const ask = page.getByRole("alertdialog", { name: "Record this bill?" });
    await expect(ask).toContainText("ABM-20601 for $180.54 is saved and posted to your books as owed.");
    await ask.getByRole("button", { name: "Save and record" }).click();
    await page.waitForURL(/\/vendor-bills\/[0-9a-f-]{36}$/);
    await expect(toasts(page).filter({ hasText: "ABM-20601 recorded" })).toBeVisible();
    await expect(page.getByTestId("bill-state")).toHaveText("Unpaid");
    await expect(page.getByTestId("bill-meta")).toContainText("Due in 30 days");
  });
});
