import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, isoDays, quote } from "./quote-seed";
import { card, moveVia, pipelineOrg } from "./pipeline-helpers";

/** Every toast on screen, from the app's one host. */
const toasts = (page: Page) => page.locator('[data-testid="toast"], [data-testid="permission-toast"]');

test.describe("US-OPS-38", () => {
  test("recording a payment from the list: the payment's page opens with its toast", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-ops-38-pay-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await api(page, "POST", "/contacts", { type: "customer", name: "Lakshmi Hospital" });
    const draft = await api(page, "POST", "/invoices", { contactId: c.id, currency: "USD", dueDate: isoDays(5), lines: [{ type: "item", name: "Site work", quantity: 1, unitPriceAmount: "100000" }] });
    const invoice = await api<{ id: string; number: string }>(page, "POST", `/invoices/${draft.id}/issue`, {});

    await page.goto("/payments");
    await page.getByRole("button", { name: "Record payment" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Record a payment" });
    await dialog.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
    await page.getByRole("option", { name: "Lakshmi Hospital" }).click();
    await dialog.getByRole("checkbox", { name: `Pay ${invoice.number}` }).check();
    await dialog.getByLabel("Amount", { exact: true }).fill("1200");
    await dialog.getByRole("button", { name: "Record payment" }).click();

    await page.waitForURL(/\/payments\/[0-9a-f-]{36}$/);
    const toast = toasts(page).first();
    await expect(toast).toContainText(/RCP-\d+ recorded/);
    await expect(toast).toContainText("$200.00 is credit for Lakshmi Hospital — apply it or refund it.");
  });

  test("a deleted or lost lead says so; toasts stack newest on top, three at most", async ({ page }) => {
    test.setTimeout(120_000);
    const org = await pipelineOrg(page);
    await org.addLead("Warehouse racking", { contactId: org.contacts.halcyon });
    await org.addLead("Retail fit-out", { contactId: org.contacts.halcyon, stage: "Proposal" });
    await page.goto("/leads");

    await card(page, "Warehouse racking").getByRole("button", { name: "Actions for Warehouse racking" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete lead" }).click();
    await expect(toasts(page).filter({ hasText: "Lead deleted" })).toContainText("“Warehouse racking” is gone from the pipeline.");

    await moveVia(page, "Retail fit-out", "Lost");
    await page.getByRole("dialog", { name: "Why was it lost?" }).getByRole("button", { name: "Skip" }).click();
    await expect(toasts(page).filter({ hasText: "Lead marked lost" })).toContainText("Retail fit-out is in Lost; add why from the lead when you know.");

    // Four in a row (a refused action, four times): three on screen, the oldest closed at once.
    await page.evaluate(() => {
      for (let i = 0; i < 4; i++) (globalThis as unknown as { dispatchEvent(e: Event): boolean }).dispatchEvent(new Event("spine:forbidden"));
    });
    await expect(page.getByTestId("permission-toast")).toHaveCount(3);
    await expect(toasts(page)).toHaveCount(3);

    // The newest is on top: the last in the page sits highest on screen.
    const tops = await toasts(page).evaluateAll((els) => (els as unknown as { getBoundingClientRect(): { top: number } }[]).map((el) => el.getBoundingClientRect().top));
    expect(tops[2]!).toBeLessThan(tops[1]!);
    expect(tops[1]!).toBeLessThan(tops[0]!);
  });

  test("deleting from a record's own page: the list it opens says so", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-ops-38-del-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await api(page, "POST", "/contacts", { type: "customer", name: "Halcyon Tech Parks" });
    const q = await quote(page, c.id, { title: "Lobby refit" });

    await page.goto(`/quotes/${q.id}`);
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Delete draft" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete draft" }).click();
    await page.waitForURL(/\/quotes$/);
    await expect(toasts(page).filter({ hasText: "Quote deleted" })).toBeVisible();

    const other = await api(page, "POST", "/contacts", { type: "customer", name: "Nimbus Data Systems" });
    await page.goto(`/contacts/${other.id}`);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await page.waitForURL(/\/contacts$/);
    await expect(toasts(page).filter({ hasText: "Contact deleted" })).toContainText("Nimbus Data Systems has been permanently removed.");
  });

  test("an action that fails says so above the page, not in a toast", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-ops-38-err-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await api(page, "POST", "/contacts", { type: "customer", name: "Halcyon Tech Parks" });
    const payment = await api<{ id: string }>(page, "POST", "/payments", { contactId: c.id, date: isoDays(0), method: "bank_transfer", currency: "USD", amount: "50000", allocations: [] });
    await page.route(`**/payments/${payment.id}`, (route) =>
      route.request().method() === "DELETE" ? route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ message: "It has been reconciled; undo the reconciliation first." }) }) : route.fallback(),
    );

    await page.goto(`/payments/${payment.id}`);
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("menuitem", { name: "Delete payment" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete payment" }).click();
    const error = page.getByTestId("action-error");
    await expect(error).toHaveText("Couldn't delete the payment. It has been reconciled; undo the reconciliation first.");
    await expect(toasts(page)).toHaveCount(0);
    await error.getByRole("button", { name: "Close this message" }).click();
    await expect(error).toHaveCount(0);
  });
});
