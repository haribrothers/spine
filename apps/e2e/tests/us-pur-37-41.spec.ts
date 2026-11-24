import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, isoDays } from "./quote-seed";

const toasts = (page: Page) => page.locator('[data-testid="toast"]');

async function setUp(page: Page, tag: string) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-pur-${tag}-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const vendor = await api<{ id: string }>(page, "POST", "/contacts", { type: "vendor", name: "Ridgeline Equipment Rentals" });
  const bill = async (billNumber: string, amount: string, date: number, due: number | null = null) => {
    const created = await api<{ id: string }>(page, "POST", "/vendor-bills", {
      contactId: vendor.id,
      billNumber,
      date: isoDays(date),
      dueDate: due === null ? null : isoDays(due),
      currency: "USD",
      lines: [{ type: "item", name: "JCB hire", quantity: 1, unitPriceAmount: amount }],
    });
    await api(page, "POST", `/vendor-bills/${created.id}/record`);
    return created;
  };
  const credit = async (vendorReference: string, amount: string, date: number, extra: Record<string, unknown> = {}, record = true) => {
    const created = await api<{ id: string }>(page, "POST", "/vendor-credits", {
      contactId: vendor.id,
      vendorReference,
      date: isoDays(date),
      currency: "USD",
      lines: [{ type: "item", name: "Day not used", quantity: 1, unitPriceAmount: amount }],
      ...extra,
    });
    if (record) await api(page, "POST", `/vendor-credits/${created.id}/record`);
    return created;
  };
  return { vendor, bill, credit };
}

test.describe("US-PUR-37", () => {
  test("a credit's page says what's left, offers one next step, and every action says what happened", async ({ page }) => {
    const { bill, credit } = await setUp(page, "37");
    const rte = await bill("RTE-3302", "100000", -16, 4);
    const older = await bill("RPH-8790", "9912", -40, -10);
    const vc = await credit("CN-77", "20000", -8, { billId: rte.id });
    await api(page, "POST", `/vendor-credits/${vc.id}/apply`, { allocations: [{ billId: older.id, amount: "9912" }] });

    await page.goto(`/vendor-credits/${vc.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("VCR-0001");
    await expect(page.getByTestId("credit-state")).toHaveText("Partly used");
    await expect(page.getByTestId("credit-meta")).toContainText("Their CN-77");
    await expect(page.getByTestId("credit-meta").getByRole("link", { name: "RTE-3302" })).toHaveAttribute("href", `/vendor-bills/${rte.id}`);
    await expect(page.getByTestId("fig-applied")).toContainText("$99.12");
    await expect(page.getByTestId("fig-refunded")).toContainText("No refunds");
    await expect(page.getByTestId("fig-left")).toContainText("$100.88");
    await expect(page.getByRole("button", { name: "Apply to bills" })).toBeVisible();
    await expect(page.getByTestId("credit-activity-entry")).toHaveCount(3);
    await expect(page.getByTestId("credit-activity-entry").first()).toContainText("Applied $99.12 to RPH-8790");

    await page.getByRole("button", { name: "More" }).click();
    for (const item of ["View history", "Void credit"]) await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
    await page.keyboard.press("Escape");

    // Record refund says what happened.
    await page.getByRole("button", { name: "Record refund" }).click();
    const refund = page.getByRole("dialog");
    await refund.locator('input[inputmode="decimal"]').fill("20");
    await refund.getByRole("button", { name: "Record refund" }).click();
    await expect(toasts(page).filter({ hasText: "Refund recorded" })).toContainText("$20.00 from Ridgeline Equipment Rentals is in your books.");
    await expect(page.getByTestId("fig-refunded")).toContainText("$20.00");

    // Removing it from a bill asks first, then says so.
    await page.getByTestId("credit-allocations").getByRole("button", { name: "Actions for RPH-8790" }).click();
    await page.getByRole("menuitem", { name: "Remove from bill" }).click();
    await page.getByRole("alertdialog", { name: "Remove this credit from RPH-8790?" }).getByRole("button", { name: "Remove from bill" }).click();
    await expect(toasts(page).filter({ hasText: "Removed from bill" })).toBeVisible();
    await expect(page.getByTestId("credit-activity-entry").first()).toContainText("Removed $99.12 from RPH-8790");

    // A draft: Record credit is the next step; Delete draft asks first.
    const draft = await credit("CN-80", "5000", -1, {}, false);
    await page.goto(`/vendor-credits/${draft.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Draft vendor credit");
    await expect(page.getByTestId("credit-state")).toHaveText("Draft");
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Delete draft" }).click();
    await page.getByRole("alertdialog", { name: "Delete this draft credit?" }).getByRole("button", { name: "Delete draft" }).click();
    await page.waitForURL(/\/vendor-credits$/);
    await expect(toasts(page).filter({ hasText: "Draft credit deleted" })).toBeVisible();
  });
});

test.describe("US-PUR-38, US-PUR-41", () => {
  test("the list shows money and state; the cards filter; ticked drafts record together", async ({ page }) => {
    const { bill, credit } = await setUp(page, "38");
    const rte = await bill("RTE-3302", "100000", -16, 4);
    const partly = await credit("CN-77", "17700", -8, { billId: rte.id });
    await api(page, "POST", `/vendor-credits/${partly.id}/apply`, { allocations: [{ billId: rte.id, amount: "9912" }] });
    await credit("CN-5420", "12980", -68);
    const voided = await credit("CR-2104", "8260", -100);
    await api(page, "POST", `/vendor-credits/${voided.id}/void`, { reason: "Wrong vendor" });
    await credit("CN-4502", "3540", -1, {}, false);
    await credit("CN-118", "5900", -2, {}, false);

    await page.goto("/vendor-credits");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vendor credits");
    const stats = page.getByTestId("credit-stats");
    await expect(stats).toContainText("$207.68");
    await expect(stats).toContainText("2 credits open or partly used");
    // Newest first; state in words; the bill; a void credit's Left to use is "—".
    await expect(page.getByRole("row").nth(1)).toContainText("CN-4502");
    const partlyRow = page.getByRole("row").filter({ hasText: "CN-77" });
    await expect(partlyRow.getByTestId("credit-row-state")).toHaveText("Partly used");
    await expect(partlyRow).toContainText("RTE-3302");
    await expect(page.getByRole("row").filter({ hasText: "CR-2104" }).getByTestId("credit-row-state")).toHaveText("Void");

    // A card filters, in the address; pressing again clears.
    await page.getByRole("button", { name: "Show unused 60+ days only" }).click();
    await expect(page).toHaveURL(/card=unused/);
    await expect(page.getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("row").nth(1)).toContainText("CN-5420");
    await page.getByRole("button", { name: "Show unused 60+ days only" }).click();
    await expect(page.getByRole("row")).toHaveCount(6);

    // Row menu, with its icons and rights.
    await page.getByRole("button", { name: "Actions for VCR-0002" }).click();
    for (const item of ["View", "Apply to bills", "Record refund", "Void"]) await expect(page.getByRole("menuitem", { name: item, exact: true })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Delete" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Drafts: tick them, Record (2) asks first, then records both.
    await page.getByRole("button", { name: "Show drafts to record only" }).click();
    await page.getByRole("checkbox", { name: "Select every row on this page" }).check();
    const bar = page.getByRole("region", { name: "Selected credits" });
    await bar.getByRole("button", { name: "Record (2)" }).click();
    const ask = page.getByRole("alertdialog", { name: "Record 2 vendor credits?" });
    await expect(ask.getByTestId("confirm-record")).toContainText("$94.40 in all");
    await ask.getByRole("button", { name: "Record credits" }).click();
    await expect(toasts(page).filter({ hasText: "2 vendor credits recorded" })).toBeVisible();
    await expect(page.getByText("No vendor credits match these filters")).toBeVisible();
  });
});

test.describe("US-PUR-39", () => {
  test("entering a credit works like a bill: same-number warning, asks before replacing lines, Save and record asks first", async ({ page }) => {
    const { bill, credit } = await setUp(page, "39");
    const rte = await bill("RTE-3302", "15000", -16, 4);
    await credit("CN-77", "17700", -8);

    await page.goto("/vendor-credits/new");
    await page.getByRole("combobox").filter({ hasText: "Select a vendor…" }).click();
    await page.getByRole("option", { name: "Ridgeline Equipment Rentals" }).click();
    await page.getByPlaceholder("e.g. CN-4471").fill(" cn-77 ");
    const warning = page.getByTestId("credit-duplicate-warning");
    await expect(warning).toContainText("Ridgeline Equipment Rentals already has credit note CN-77");
    await expect(warning.getByRole("link", { name: "Open VCR-0001" })).toBeVisible();
    await page.getByPlaceholder("e.g. CN-4471").fill("CN-81");
    await expect(warning).toHaveCount(0);

    // The bill builder's rows: Account, item lines only, the bar at the bottom.
    await expect(page.getByRole("combobox", { name: "Account" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Add heading" })).toHaveCount(0);
    await page.getByRole("combobox", { name: "Item" }).first().fill("Breaker attachment — returned");
    await page.keyboard.press("Escape");

    // Choosing a bill after typing lines asks first; keeping them keeps them.
    await page.getByRole("combobox", { name: "Against bill" }).click();
    await page.getByRole("option", { name: /^RTE-3302/ }).click();
    const replace = page.getByRole("alertdialog", { name: "Replace your lines with RTE-3302's?" });
    await replace.getByRole("button", { name: "Keep my lines" }).click();
    await expect(page.getByRole("combobox", { name: "Item" }).first()).toHaveValue("Breaker attachment — returned");
    await page.getByRole("combobox", { name: "Against bill" }).click();
    await page.getByRole("option", { name: "No bill" }).click();
    await page.getByRole("combobox", { name: "Against bill" }).click();
    await page.getByRole("option", { name: /^RTE-3302/ }).click();
    await replace.getByRole("button", { name: "Replace lines" }).click();
    await expect(page.getByRole("combobox", { name: "Item" }).first()).toHaveValue("JCB hire");
    await expect(page.getByTestId("credit-builder-bar")).toContainText("$150.00");

    // Leaving with changes asks first.
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("alertdialog", { name: "Leave without saving?" }).getByRole("button", { name: "Keep editing" }).click();

    await page.getByRole("button", { name: "Save and record" }).click();
    const ask = page.getByRole("alertdialog", { name: "Record this vendor credit?" });
    await expect(ask).toContainText("$150.00 from Ridgeline Equipment Rentals is saved and posted to your books");
    await ask.getByRole("button", { name: "Save and record" }).click();
    await page.waitForURL(/\/vendor-credits\/[0-9a-f-]{36}$/);
    await expect(toasts(page).filter({ hasText: "VCR-0002 recorded" })).toBeVisible();
    await expect(page.getByTestId("credit-state")).toHaveText("Open");
    await expect(page.getByTestId("credit-meta").getByRole("link", { name: "RTE-3302" })).toHaveAttribute("href", `/vendor-bills/${rte.id}`);
  });
});

test.describe("US-PUR-40", () => {
  test("a bill's More menu raises a credit from it; applying puts that bill first", async ({ page }) => {
    const { bill } = await setUp(page, "40");
    const older = await bill("RPH-8790", "5000", -40, -10);
    const rte = await bill("RTE-3302", "40640", -16, 4);

    await page.goto(`/vendor-bills/${rte.id}`);
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Record vendor credit" }).click();
    await page.waitForURL(new RegExp(`/vendor-credits/new\\?billId=${rte.id}$`));
    await expect(page.getByRole("combobox", { name: "Against bill" })).toContainText("RTE-3302");
    await expect(page.getByRole("combobox", { name: "Item" }).first()).toHaveValue("JCB hire");
    await page.getByPlaceholder("e.g. CN-4471").fill("CN-77");
    await page.getByRole("button", { name: "Save and record" }).click();
    await page.getByRole("alertdialog", { name: "Record this vendor credit?" }).getByRole("button", { name: "Save and record" }).click();
    await page.waitForURL(/\/vendor-credits\/[0-9a-f-]{36}$/);

    await page.getByRole("button", { name: "Apply to bills" }).click();
    const dialog = page.getByRole("dialog", { name: "Apply VCR-0001 to bills" });
    const rows = dialog.getByTestId("bill-to-apply");
    await expect(rows.first()).toContainText("RTE-3302");
    await expect(rows.first()).toContainText("Against this credit");
    await expect(rows.first()).toContainText("Due in 4 days");
    await expect(rows.nth(1)).toContainText("RPH-8790");
    await expect(rows.nth(1)).toContainText("10 days late");
    await expect(dialog.getByRole("textbox", { name: "Amount to apply to bill RTE-3302" })).toHaveValue("406.40");
    await expect(dialog.getByTestId("apply-summary")).toContainText("Applying $406.40");
    await expect(dialog.getByTestId("apply-summary")).toContainText("$0.00 left on VCR-0001");
    await dialog.getByRole("textbox", { name: "Amount to apply to bill RTE-3302" }).fill("356.40");
    await dialog.getByRole("checkbox", { name: "Apply to bill RPH-8790" }).check();
    await expect(dialog.getByRole("textbox", { name: "Amount to apply to bill RPH-8790" })).toHaveValue("50.00");
    await dialog.getByRole("button", { name: "Apply $406.40" }).click();
    await expect(toasts(page).filter({ hasText: "Credit applied" })).toContainText("$406.40 of VCR-0001 now counts against 2 bills.");
    await expect(page.getByTestId("credit-state")).toHaveText("Used");
    await expect(page.getByTestId("credit-allocation")).toHaveCount(2);
    void older;
  });
});
