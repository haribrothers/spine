import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user, in the default Team. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

type Row = { kind: string; count: number; items: { id: string; number: string | null }[] };
const rowsOf = async (page: Page) => (await (await page.request.get(`${API_URL}/dashboard/attention`)).json()) as Row[];

async function setGrant(page: Page, capability: string, granted: boolean) {
  const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
  const res = await page.request.put(`${API_URL}/org/teams/${teams.find((t) => t.isDefault)!.id}/privileges`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { privileges: [{ capability, granted }] },
  });
  expect(res.ok()).toBe(true);
}

test.describe("US-DASH-13", () => {
  test("one overdue invoice: 'Send reminder' opens its reminder email to check and send", async ({ page, seededOrg: _ }) => {
    const overdue = (await rowsOf(page)).find((r) => r.kind === "invoices_overdue");
    expect(overdue?.count, "the demo data has one overdue invoice").toBe(1);
    await page.goto("/dashboard");
    await page.locator('li[data-kind="invoices_overdue"]').getByRole("link", { name: "Send reminder" }).click();
    // Nothing is emailed from one click (D-217): the invoice opens with the reminder ready.
    const dialog = page.getByRole("dialog", { name: `Send payment reminder — ${overdue!.items[0]!.number}` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Send reminder" }).click();
    await expect(page.getByText("Reminder sent", { exact: true }).first()).toBeVisible();
  });

  test("'Review' opens expenses waiting for approval", async ({ page, seededOrg: _ }) => {
    test.skip(!(await rowsOf(page)).some((r) => r.kind === "expenses_awaiting_approval"), "no expenses waiting in the demo data");
    await page.goto("/dashboard");
    await page.locator('li[data-kind="expenses_awaiting_approval"]').getByRole("link", { name: "Review" }).click();
    await expect(page).toHaveURL(/\/expenses\?status=submitted/);
    await expect(page.getByRole("combobox", { name: "Filter by status" })).toContainText("Submitted");
  });

  test("several overdue invoices: 'Send reminder' opens Invoices filtered to overdue with them selected", async ({ page, seededOrg: _ }) => {
    // A second overdue invoice.
    const contacts = (await (await page.request.get(`${API_URL}/contacts`)).json()) as { id: string; type: string }[];
    const customer = contacts.find((c) => c.type !== "vendor")!;
    const due = new Date();
    due.setDate(due.getDate() - 5);
    const draft = (await (
      await page.request.post(`${API_URL}/invoices`, {
        headers: { "Idempotency-Key": randomUUID() },
        data: { contactId: customer.id, currency: "USD", dueDate: due.toISOString().slice(0, 10), lines: [{ name: "Site visit", quantity: 1, unitPriceAmount: "25000" }] },
      })
    ).json()) as { id: string };
    expect((await page.request.post(`${API_URL}/invoices/${draft.id}/issue`, { headers: { "Idempotency-Key": randomUUID() } })).ok()).toBe(true);
    const overdue = (await rowsOf(page)).find((r) => r.kind === "invoices_overdue")!;
    expect(overdue.count).toBeGreaterThan(1);

    await page.goto("/dashboard");
    await page.locator('li[data-kind="invoices_overdue"]').getByRole("link", { name: "Send reminder" }).click();
    await expect(page).toHaveURL(/\/invoices\?status=overdue&select=overdue/);
    await expect(page.getByRole("region", { name: "Selected invoices" })).toContainText(`${overdue.count} selected`);
  });

  test("'Pay bill' lands on the vendor payment dialog for that vendor", async ({ page, seededOrg: _ }) => {
    const vendors = (await (await page.request.get(`${API_URL}/contacts?type=vendor`)).json()) as { id: string; name: string }[];
    await page.goto(`/vendor-payments?contactId=${vendors[0]!.id}&pay=1`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(vendors[0]!.name);
  });

  test("without 'Send a payment reminder' the button reads 'Open'", async ({ page, seededOrg: _, browser }) => {
    await setGrant(page, "invoices.send_reminder", false);
    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto("/dashboard");
    const row = staff.locator('li[data-kind="invoices_overdue"]');
    await expect(row.getByRole("link", { name: "Open" })).toBeVisible();
    await expect(row.getByRole("button", { name: "Send reminder" })).toHaveCount(0);
    await context.close();
    await setGrant(page, "invoices.send_reminder", true);
  });
});
