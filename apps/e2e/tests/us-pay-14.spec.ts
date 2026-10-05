import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user, in the default Team. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

async function customerWithInvoices(page: Page) {
  const invoices = (await (await page.request.get(`${API_URL}/invoices`)).json()) as { contactId: string; status: string }[];
  const contactId = invoices.find((i) => i.status === "issued")!.contactId;
  return (await (await page.request.get(`${API_URL}/contacts/${contactId}`)).json()) as { id: string; name: string; email: string | null };
}

async function setReceivablesGrant(page: Page, granted: boolean) {
  const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
  const res = await page.request.put(`${API_URL}/org/teams/${teams.find((t) => t.isDefault)!.id}/privileges`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { privileges: [{ capability: "reports.view_receivables", granted }] },
  });
  expect(res.ok()).toBe(true);
}

test.describe("US-PAY-14", () => {
  test("'Send a statement' shows the period, summary and recipient; Download PDF saves it and Send emails it and logs it", async ({ page, seededOrg: _ }) => {
    const contact = await customerWithInvoices(page);
    await page.goto(`/contacts/${contact.id}`);
    await page.getByRole("button", { name: "Send statement" }).click();

    const dialog = page.getByRole("dialog", { name: "Send a statement" });
    await dialog.getByRole("combobox", { name: "Period" }).click();
    await expect(page.getByRole("option")).toHaveText(["Last 30 days", "Last 90 days", "This year", "Custom"]);
    await page.getByRole("option", { name: "This year" }).click();
    await dialog.getByRole("combobox", { name: "Show" }).click();
    await expect(page.getByRole("option")).toHaveText(["Open invoices only", "All activity"]);
    await page.getByRole("option", { name: "All activity" }).click();

    for (const label of [/^Opening balance \(Jan 1\)$/, /^Invoiced$/, /^Paid and credited$/, /^Balance due$/]) {
      await expect(dialog.getByRole("term").filter({ hasText: label })).toBeVisible();
    }
    await expect(dialog.getByRole("textbox", { name: "To" })).toHaveValue(contact.email ?? "");

    const downloading = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download PDF" }).click();
    expect((await downloading).suggestedFilename()).toMatch(/^statement-.+-\d{4}-\d{2}-\d{2}\.pdf$/);

    await dialog.getByRole("textbox", { name: "To" }).fill("accounts@statement-test.example");
    await dialog.getByRole("button", { name: "Send statement" }).click();
    await expect(page.getByText("Statement sent to accounts@statement-test.example").first()).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(/Statement sent to accounts@statement-test\.example for /).first()).toBeVisible();
  });

  test("a customer with no invoices can't be sent one", async ({ page, seededOrg: _ }) => {
    const res = await page.request.post(`${API_URL}/contacts`, { headers: { "Idempotency-Key": randomUUID() }, data: { name: `Priya Nair ${randomUUID().slice(0, 4)}`, type: "customer", email: "priya@example.com" } });
    const contact = (await res.json()) as { id: string };
    await page.goto(`/contacts/${contact.id}`);
    await page.getByRole("button", { name: "Send statement" }).click();
    const dialog = page.getByRole("dialog", { name: "Send a statement" });
    await expect(dialog.getByText("No invoices for this customer yet.")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Send statement" })).toBeDisabled();
  });

  test("without 'View receivables' the button isn't shown", async ({ page, seededOrg: _, browser }) => {
    const contact = await customerWithInvoices(page);
    await setReceivablesGrant(page, false);
    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto(`/contacts/${contact.id}`);
    await expect(staff.getByRole("heading", { name: contact.name })).toBeVisible();
    await expect(staff.getByRole("button", { name: "Send statement" })).toHaveCount(0);
    await context.close();
    await setReceivablesGrant(page, true);
  });
});
