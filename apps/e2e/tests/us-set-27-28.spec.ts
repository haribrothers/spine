import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api, contact, quote, send } from "./quote-seed";

interface Entry {
  id: string;
  entityId: string | null;
  status: string;
}

const emails = (page: Page) => api<Entry[]>(page, "GET", "/emails");
const statusOf = async (page: Page, entityId: string) => (await emails(page)).find((e) => e.entityId === entityId)?.status;

/** An issued invoice for a customer with no email address, emailed: every try fails. */
async function failingInvoiceEmail(page: Page, customerId: string) {
  const draft = await api(page, "POST", "/invoices", { contactId: customerId, currency: "USD", lines: [{ type: "item", name: "Site visit", quantity: 1, unitPriceAmount: "50000" }] });
  const invoice = await api<{ id: string; number: string }>(page, "POST", `/invoices/${draft.id}/issue`, {});
  await api(page, "POST", `/invoices/${invoice.id}/send-email`, {});
  await expect.poll(() => statusOf(page, invoice.id), { timeout: 30_000 }).toMatch(/retrying|failed/);
  return invoice;
}

test.describe("US-SET-27", () => {
  test("an Owner sees every email: sent quotes, failing invoices, cards, search in the address", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-set-27-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const c = await contact(page, "Ananya Rao");
    const sent = await send(page, (await quote(page, c.id, { title: "Bathroom refit" })).id);
    await expect.poll(() => statusOf(page, sent.id), { timeout: 30_000 }).toBe("sent");
    const nobody = await api(page, "POST", "/contacts", { type: "customer", name: "Halcyon Tech Parks" });
    const failing = await failingInvoiceEmail(page, nobody.id);

    // From Settings › Emails.
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Priya Raman/ }).last().click();
    await page.getByRole("menuitem", { name: "Settings" }).click();
    await page.getByRole("dialog").getByTestId("settings-sections").getByRole("button", { name: "Emails" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Email log" }).click();
    await expect(page).toHaveURL(/\/emails$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Email log");

    const quoteRow = page.getByRole("row", { name: new RegExp(sent.number) });
    await expect(quoteRow.getByTestId("email-status")).toHaveText("Sent");
    await expect(quoteRow).toContainText("ananya.rao@example.com");
    await expect(quoteRow).toContainText("Quote");
    const invoiceRow = page.getByRole("row", { name: new RegExp(failing.number) });
    await expect(invoiceRow.getByTestId("email-status")).toHaveText(/Retrying|Failed/);
    await expect(invoiceRow).toContainText("no email address");

    // The Waiting card filters, and the address keeps it.
    await page.getByRole("button", { name: /Show waiting emails/ }).click();
    await expect(page).toHaveURL(/card=waiting/);
    await expect(page.getByRole("row", { name: new RegExp(sent.number) })).toHaveCount(0);
    await page.getByRole("button", { name: /Show waiting emails/ }).click();

    await page.getByRole("searchbox", { name: "Search emails" }).fill(sent.number);
    await expect(page).toHaveURL(new RegExp(`q=${sent.number}`));
    await expect(page.getByRole("row", { name: new RegExp(failing.number) })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("searchbox", { name: "Search emails" })).toHaveValue(sent.number);
    await expect(page.getByRole("row", { name: new RegExp(sent.number) })).toBeVisible();
  });
});

test.describe("US-SET-28", () => {
  test("Retry now and Cancel each ask first; a cancelled invoice email says so and links back to the log", async ({ page }) => {
    await signUpNewOrg(page, { name: "Priya Raman", email: `e2e-set-28-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const nobody = await api(page, "POST", "/contacts", { type: "customer", name: "Halcyon Tech Parks" });
    const retried = await failingInvoiceEmail(page, nobody.id);
    const cancelled = await failingInvoiceEmail(page, nobody.id);
    await page.goto("/emails");

    // Retry now: "Retry this email?" names it and the last error.
    await page.getByRole("row", { name: new RegExp(retried.number) }).getByRole("button", { name: /Actions for the email/ }).click();
    await page.getByRole("menuitem", { name: "Retry now" }).click();
    const ask = page.getByRole("alertdialog", { name: "Retry this email?" });
    await expect(ask.getByTestId("confirm-description")).toContainText(`The invoice for ${retried.number}`);
    await expect(ask.getByTestId("confirm-description")).toContainText("Last time it failed:");
    await ask.getByRole("button", { name: "Retry email" }).click();
    await expect(page.getByText("Email queued again", { exact: true }).first()).toBeVisible();

    // Cancel: "Cancel this email?"; Go back does nothing.
    const row = page.getByRole("row", { name: new RegExp(cancelled.number) });
    await row.getByRole("button", { name: /Actions for the email/ }).click();
    await page.getByRole("menuitem", { name: "Cancel" }).click();
    const cancel = page.getByRole("alertdialog", { name: "Cancel this email?" });
    await expect(cancel.getByTestId("confirm-description")).toContainText("won't be sent");
    await cancel.getByRole("button", { name: "Cancel email" }).click();
    await expect(row.getByTestId("email-status")).toHaveText("Cancelled");
    await expect(row).toContainText("Cancelled by Priya Raman");
    await row.getByRole("button", { name: /Actions for the email/ }).click();
    await expect(page.getByRole("menuitem", { name: "Cancel" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Retry now" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: `Open ${cancelled.number}` }).click();

    await expect(page).toHaveURL(new RegExp(`/invoices/${cancelled.id}`));
    await expect(page.getByTestId("email-failed")).toContainText("Email not sent — cancelled");
    await page.getByTestId("email-failed").getByRole("link", { name: "See it in the email log" }).click();
    await expect(page).toHaveURL(new RegExp(`/emails\\?record=${cancelled.id}`));
    await expect(page.getByTestId("email-record-filter")).toHaveText(`Emails for ${cancelled.number}`);
    await expect(page.getByRole("row", { name: new RegExp(retried.number) })).toHaveCount(0);
  });
});
