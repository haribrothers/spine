import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, isoDays } from "./quote-seed";

const toasts = (page: Page) => page.locator('[data-testid="toast"]');
const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n", "latin1");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function setUp(page: Page, tag: string) {
  await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-exp-${tag}-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const category = await api<{ id: string; name: string }>(page, "POST", "/expense-categories", { name: "Fuel & freight" });
  const submit = (amount: string, days: number, description: string, extra: Record<string, unknown> = {}) =>
    api<{ id: string }>(page, "POST", "/expenses", { categoryId: category.id, date: isoDays(days), currency: "USD", amount, taxAmount: "0", paidBy: "employee", description, ...extra });
  return { category, submit };
}

test.describe("US-PUR-42", () => {
  test("the list shows what's waiting and what it's cost; the cards filter; rows act from their menu", async ({ page }) => {
    const { submit } = await setUp(page, "42");
    await submit("4850", 0, "Diesel for the JCB");
    await submit("1800", -1, "Site lunch");
    const approved = await submit("12400", -2, "Safety helmets", { isBillable: true });
    await api(page, "POST", `/expenses/${approved.id}/approve`, { comment: null });
    const rejected = await submit("1200", -8, "Taxi to the supplier");
    await api(page, "POST", `/expenses/${rejected.id}/reject`, { comment: "Use the site van." });

    await page.goto("/expenses");
    const stats = page.getByTestId("expense-stats");
    await expect(stats).toContainText("Waiting for approval");
    await expect(stats).toContainText("$66.50");
    await expect(stats).toContainText("$124.00");
    // Newest first; the state in words; a ready-to-bill expense says Billable.
    await expect(page.getByRole("row").nth(1)).toContainText("Diesel for the JCB");
    await expect(page.getByRole("row").filter({ hasText: "Safety helmets" }).getByTestId("expense-row-state")).toHaveText("Approved");
    await expect(page.getByRole("row").filter({ hasText: "Safety helmets" })).toContainText("Billable");
    await expect(page.getByRole("row").filter({ hasText: "Taxi to the supplier" }).getByTestId("expense-row-state")).toHaveText("Rejected");

    // A card filters, in the address; pressing again clears.
    await page.getByRole("button", { name: "Show rejected only" }).click();
    await expect(page).toHaveURL(/card=rej/);
    await expect(page.getByRole("row")).toHaveCount(2);
    await page.getByRole("button", { name: "Show rejected only" }).click();
    await expect(page.getByRole("row")).toHaveCount(5);
    // The dashboard's older link still works.
    await page.goto("/expenses?status=submitted");
    await expect(page.getByRole("row")).toHaveCount(3);

    // Row menu with its icons; approving from it asks first and says so.
    await page.goto("/expenses");
    await page.getByRole("button", { name: "Actions for Site lunch" }).click();
    for (const item of ["View", "Edit", "Approve", "Reject", "Delete"]) await expect(page.getByRole("menuitem", { name: item, exact: true })).toBeVisible();
    await page.getByRole("menuitem", { name: "Approve", exact: true }).click();
    await page.getByRole("dialog", { name: "Approve this expense?" }).getByRole("button", { name: "Approve", exact: true }).click();
    await expect(toasts(page).filter({ hasText: "approved" })).toContainText("$18.00 is posted to your books.");
    await expect(page.getByRole("row").filter({ hasText: "Site lunch" }).getByTestId("expense-row-state")).toHaveText("Approved");
  });
});

test.describe("US-PUR-43, US-PUR-45", () => {
  test("an expense's page shows its receipt and Activity; Approve and next moves on; a rejected one is fixed and resubmitted", async ({ page }) => {
    const { submit } = await setUp(page, "43");
    const older = await submit("1800", -3, "Site lunch");
    const diesel = await submit("4850", 0, "Diesel for the JCB");

    // The old drawer link opens the page.
    await page.goto(`/expenses?id=${diesel.id}`);
    await page.waitForURL(new RegExp(`/expenses/${diesel.id}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Expense");
    await expect(page.getByTestId("expense-state")).toHaveText("Waiting for approval");
    await expect(page.getByTestId("expense-meta")).toContainText("Submitted by you");
    await expect(page.getByTestId("fig-amount")).toContainText("$48.50");
    await expect(page.getByTestId("expense-activity-entry").first()).toContainText("Submitted for approval");

    // Approve and next: approves this one and opens the oldest still waiting.
    await page.getByTestId("expense-actions").getByRole("button", { name: "Approve and next" }).click();
    await page.getByRole("dialog", { name: "Approve this expense?" }).getByRole("button", { name: "Approve and next" }).click();
    await page.waitForURL(new RegExp(`/expenses/${older.id}$`));
    await expect(toasts(page).filter({ hasText: "approved" })).toContainText("Opening the next one waiting");

    // Reject it with a reason, then fix and resubmit.
    await page.getByTestId("expense-actions").getByRole("button", { name: "Reject", exact: true }).click();
    const reject = page.getByRole("dialog", { name: "Reject this expense?" });
    await reject.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(reject).toContainText("Say why it's rejected, so it can be fixed.");
    await reject.getByLabel(/Reason/).fill("Attach the itemised receipt.");
    await reject.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(page.getByTestId("expense-rejection")).toContainText("“Attach the itemised receipt.”");
    await page.getByTestId("expense-actions").getByRole("button", { name: "Fix and resubmit" }).click();
    const fix = page.getByRole("dialog", { name: "Fix and resubmit" });
    await expect(fix).toContainText("“Attach the itemised receipt.”");
    await fix.getByLabel("Choose receipt and files").setInputFiles({ name: "lunch-receipt.png", mimeType: "image/png", buffer: PNG });
    await expect(fix.getByTestId("receipt-preview")).toBeVisible();
    await fix.getByRole("button", { name: "Resubmit" }).click();
    await expect(toasts(page).filter({ hasText: "Expense resubmitted" })).toBeVisible();
    await expect(page.getByTestId("expense-state")).toHaveText("Waiting for approval");
    await expect(page.getByTestId("expense-receipt").getByTestId("receipt-preview")).toBeVisible();
    const entries = page.getByTestId("expense-activity-entry");
    await expect(entries.nth(0)).toContainText("Fixed and resubmitted");
    await expect(entries.nth(1)).toContainText("Rejected · “Attach the itemised receipt.”");
  });
});

test.describe("US-PUR-44", () => {
  test("submitting: the currency is a picker, tax is worked out, several files go with it, the same amount warns, and Submit and add another", async ({ page }) => {
    const { submit } = await setUp(page, "44");
    await submit("4850", 0, "Diesel for the JCB");
    await api(page, "POST", "/tax-rates", { name: "Fuel tax", rate: 18 });

    await page.goto("/expenses");
    await page.getByRole("button", { name: "Submit expense" }).first().click();
    const form = page.getByRole("dialog", { name: "Submit an expense" });
    await expect(form.getByRole("combobox", { name: "Currency" })).toHaveText(/USD/);
    await form.locator("div", { hasText: /^Category/ }).getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Fuel & freight" }).click();
    await form.getByRole("textbox", { name: "Amount", exact: true }).fill("48.50");

    // Tax is worked out as included in the amount until it's typed over: 48.50 × 18/118 = 7.40.
    await form.locator("div", { hasText: /^Tax rate/ }).getByRole("combobox").first().click();
    await page.getByRole("option", { name: /Fuel tax/ }).click();
    await expect(form.getByRole("textbox", { name: "Tax amount" })).toHaveValue("7.40");
    await expect(form).toContainText("Worked out from Fuel tax, included in the amount.");

    // The same amount on the same day warns, with a link; it still submits.
    await expect(form.getByTestId("expense-duplicate-warning")).toContainText("You submitted $48.50");
    await expect(form.getByTestId("expense-duplicate-warning").getByRole("link", { name: "Open it" })).toHaveAttribute("href", /\/expenses\/[0-9a-f-]{36}$/);

    // A receipt and another file, from "Add files".
    await form.getByLabel("Choose receipt and files").setInputFiles([
      { name: "diesel-receipt.png", mimeType: "image/png", buffer: PNG },
      { name: "pump-log.pdf", mimeType: "application/pdf", buffer: PDF },
    ]);
    await expect(form.getByTestId("receipt-preview")).toBeVisible();
    await expect(form.getByTestId("expense-extra-files")).toContainText("pump-log.pdf");
    await expect(form.getByRole("button", { name: "Add files" })).toBeVisible();

    await form.getByRole("textbox", { name: "Description" }).fill("Diesel — second fill");
    await form.getByRole("button", { name: "Submit and add another" }).click();
    await expect(toasts(page).filter({ hasText: "Expense submitted" })).toContainText("$48.50 is waiting for approval.");
    // The form stays open for the next receipt, emptied.
    await expect(form.getByRole("textbox", { name: "Description" })).toHaveValue("");
    await expect(form.getByTestId("receipt-preview")).toHaveCount(0);
    await page.keyboard.press("Escape");

    const rows = await api<{ id: string; description: string | null; receiptFileId: string | null }[]>(page, "GET", "/expenses");
    const saved = rows.find((r) => r.description === "Diesel — second fill")!;
    expect(saved.receiptFileId).toBeTruthy();
    const attachments = await api<{ originalFilename?: string; fileName?: string; name?: string }[]>(page, "GET", `/attachments?entityType=expense&entityId=${saved.id}`);
    expect(JSON.stringify(attachments)).toContain("pump-log.pdf");
  });
});
