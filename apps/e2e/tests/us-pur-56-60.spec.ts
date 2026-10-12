import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, isoDays } from "./quote-seed";

const toasts = (page: Page) => page.locator('[data-testid="toast"]');
const confirmDialog = (page: Page, name: string | RegExp) => page.getByRole("alertdialog", { name }).or(page.getByRole("dialog", { name }));

/** Two vendors: Ridgeline with a late bill and one due in 3 days, Coastline with a late bill, open credit and a draft. */
async function setUp(page: Page, tag: string) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-ap-${tag}-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const ridgeline = await api<{ id: string }>(page, "POST", "/contacts", { type: "vendor", name: "Ridgeline Equipment Rentals" });
  const coastline = await api<{ id: string }>(page, "POST", "/contacts", { type: "vendor", name: "Coastline Steel Works" });
  const bill = async (contactId: string, billNumber: string, amount: string, due: number, record = true) => {
    const created = await api<{ id: string }>(page, "POST", "/vendor-bills", {
      contactId,
      billNumber,
      date: isoDays(due - 30),
      dueDate: isoDays(due),
      currency: "USD",
      lines: [{ type: "item", name: "Hire", quantity: 1, unitPriceAmount: amount }],
    });
    if (record) await api(page, "POST", `/vendor-bills/${created.id}/record`);
    return created;
  };
  await bill(ridgeline.id, "RTE-3302", "40000", -12);
  await bill(ridgeline.id, "RTE-3340", "23600", 3);
  await bill(coastline.id, "CSW-4471", "58200", -33);
  await bill(coastline.id, "CSW-4502", "18400", 20, false);
  const credit = await api<{ id: string }>(page, "POST", "/vendor-credits", { contactId: coastline.id, vendorReference: "CN-88", date: isoDays(-2), currency: "USD", lines: [{ type: "item", name: "Returned", quantity: 1, unitPriceAmount: "9440" }] });
  await api(page, "POST", `/vendor-credits/${credit.id}/record`);
}

test.describe("US-PUR-56, US-PUR-60", () => {
  test("By vendor adds up what we owe each vendor, expands to their bills, and says what it counts", async ({ page }) => {
    await setUp(page, "56");
    await page.goto("/payables");

    await expect(page.locator("main h1 + p")).toHaveText(/^What you owe vendors, by how late it is · as of /);
    await expect(page.getByRole("tab", { name: "By vendor, 2" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("aging-cards")).toContainText("Total owed");
    await expect(page.getByTestId("aging-cards")).toContainText("Due in 7 days");
    await expect(page.getByTestId("payables-updated")).toHaveText("Updated just now");
    await expect(page.getByTestId("drafts-note")).toContainText("1 draft bill ($184.00) isn't counted here — record it to include it.");
    await expect(page.getByTestId("drafts-note").getByRole("link", { name: "See drafts" })).toHaveAttribute("href", "/vendor-bills?card=drafts");

    // Most overdue money first: Coastline ($582 overdue) before Ridgeline ($400).
    const rows = page.getByRole("row");
    await expect(rows.nth(1)).toContainText("Coastline Steel Works");
    await expect(rows.nth(1)).toContainText("33 days late");
    await expect(rows.nth(1)).toContainText("$94.40");
    await expect(rows.nth(1)).toContainText("Never");
    await expect(rows.nth(2)).toContainText("Ridgeline Equipment Rentals");
    await expect(rows.nth(2)).toContainText("2 bills");
    await expect(page.locator("tfoot")).toContainText("2 vendors");
    await expect(page.locator("tfoot")).toContainText("$1,218.00");

    await page.getByRole("button", { name: "Show Ridgeline Equipment Rentals's bills" }).click();
    const under = page.getByTestId("vendor-bills");
    await expect(under.locator("li").nth(0)).toContainText("RTE-3302");
    await expect(under.locator("li").nth(0)).toContainText("12 days late");
    await expect(under.locator("li").nth(1)).toContainText("Due in 3 days");

    // The vendor's menu.
    await page.getByRole("button", { name: "Actions for Coastline Steel Works" }).click();
    for (const item of ["Pay vendor", "Apply credit", "Open contact"]) await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Actions for Ridgeline Equipment Rentals" }).click();
    await expect(page.getByRole("menuitem", { name: "Apply credit" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Search on By vendor matches the name; the page comes back the same after Back.
    await page.getByRole("searchbox", { name: "Search payables" }).fill("coast");
    await expect(page).toHaveURL(/q=coast/);
    await page.getByRole("link", { name: "Coastline Steel Works" }).click();
    await page.waitForURL(/\/contacts\//);
    await page.goBack();
    await expect(page.getByRole("searchbox", { name: "Search payables" })).toHaveValue("coast");
    await expect(page.getByRole("row").filter({ hasText: "Ridgeline" })).toHaveCount(0);
  });
});

test.describe("US-PUR-59, US-PUR-57", () => {
  test("cards and ages filter both tabs; Due in 7 days plans the week; an empty age says so", async ({ page }) => {
    await setUp(page, "59");
    await page.goto("/payables?view=bills");

    const due7 = page.getByRole("button", { name: "Show due in 7 days only" });
    await due7.click();
    await expect(due7).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/age=due7/);
    await expect(page.getByRole("combobox", { name: "Show by age" })).toHaveText("Due in 7 days");
    const table = page.getByRole("table");
    await expect(table).toContainText("RTE-3340");
    await expect(table).toContainText("Due in 3 days");
    await expect(table).not.toContainText("RTE-3302");

    // Pressing again shows all; each bill says how late in words.
    await due7.click();
    await expect(due7).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByRole("row").filter({ hasText: "CSW-4471" })).toContainText("33 days late");
    // Bill date, Bill total and Paid so far start hidden.
    await expect(page.getByRole("columnheader", { name: "Paid so far" })).toHaveCount(0);

    await page.getByRole("combobox", { name: "Show by age" }).click();
    await page.getByRole("option", { name: "61–90 days" }).click();
    await expect(page.getByText("Nothing 61–90 days late.")).toBeVisible();
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(page).not.toHaveURL(/age=/);

    // Export follows the age.
    await page.getByRole("button", { name: "Show overdue only" }).click();
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const [file] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()]);
    const { readFileSync } = await import("node:fs");
    const lines = readFileSync((await file.path())!, "utf8").split("\r\n").slice(1);
    expect(lines.map((l) => l.split(",")[0]).sort()).toEqual(["CSW-4471", "RTE-3302"]);
  });
});

test.describe("US-PUR-58", () => {
  test("Pay (n) pays ticked bills from one vendor; bills from two vendors can't; a bill's menu pays or applies credit", async ({ page }) => {
    await setUp(page, "58");
    // Room for the row menu to open below its button.
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/payables?view=bills");

    // Bills from two vendors: Pay is off and says why.
    await page.getByRole("checkbox", { name: "Select CSW-4471" }).check();
    await page.getByRole("checkbox", { name: "Select RTE-3302" }).check();
    const bar = page.getByTestId("payables-bulk-bar");
    await expect(bar.getByRole("button", { name: "Pay (2)" })).toBeDisabled();
    await expect(bar).toContainText("Pick bills from one vendor — a payment is for one vendor.");

    // Both of Ridgeline's: the dialog opens with them ticked for their balances.
    await page.getByRole("checkbox", { name: "Select CSW-4471" }).uncheck();
    await page.getByRole("checkbox", { name: "Select RTE-3340" }).check();
    await bar.getByRole("button", { name: "Pay (2)" }).click();
    const dialog = page.getByRole("dialog", { name: "Record a vendor payment" });
    await expect(dialog.getByRole("checkbox", { name: "Pay RTE-3302" })).toBeChecked();
    await expect(dialog.getByRole("checkbox", { name: "Pay RTE-3340" })).toBeChecked();
    await expect(dialog.getByTestId("vendor-payment-summary")).toHaveText("$636.00 pays RTE-3302 in full and RTE-3340 in full.");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    const ask = confirmDialog(page, "Record this payment?");
    await ask.getByRole("button", { name: "Record payment" }).click();
    await expect(toasts(page).filter({ hasText: "recorded" })).toContainText("The bills it pays owe less");
    // The page refreshes in place: Ridgeline's bills are gone.
    await expect(page).toHaveURL(/\/payables\?view=bills$/);
    await expect(page.getByRole("table")).not.toContainText("RTE-3302");

    // A bill's menu: Pay bill, Apply credit (Coastline has credit) and Open bill.
    await page.getByRole("button", { name: "Actions for CSW-4471" }).click();
    for (const item of ["Pay bill", "Apply credit", "Open bill"]) await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
    await page.getByRole("menuitem", { name: "Apply credit" }).click();
    const apply = page.getByRole("dialog", { name: "Apply credit to CSW-4471" });
    await apply.getByRole("button", { name: /^Apply/ }).click();
    await expect(toasts(page).filter({ hasText: "Credit applied" })).toContainText("$94.40 now counts against CSW-4471");
    await expect(page.getByRole("row").filter({ hasText: "CSW-4471" })).toContainText("$487.60");
  });
});
