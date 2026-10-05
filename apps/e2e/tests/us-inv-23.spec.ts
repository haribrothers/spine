import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user, in the default Team. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

interface ListedInvoice {
  id: string;
  number: string | null;
  status: string;
  balanceDue: string;
  remindedToday: boolean;
}

async function tick(page: Page, invoice: ListedInvoice) {
  const search = page.getByPlaceholder("Search invoices");
  await search.fill(invoice.number ?? "");
  await page.getByRole("checkbox", { name: `Select ${invoice.number ?? "draft invoice"}` }).first().check();
  await search.fill("");
}

async function setReminderGrant(page: Page, granted: boolean) {
  const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
  const res = await page.request.put(`${API_URL}/org/teams/${teams.find((t) => t.isDefault)!.id}/privileges`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { privileges: [{ capability: "invoices.send_reminder", granted }] },
  });
  expect(res.ok()).toBe(true);
}

test.describe("US-INV-23", () => {
  test("ticking rows shows the bar; Send reminders counts only eligible invoices and reports the skipped ones", async ({ page, seededOrg: _ }) => {
    const invoices = (await (await page.request.get(`${API_URL}/invoices`)).json()) as ListedInvoice[];
    const eligible = invoices.find((i) => i.status === "issued" && BigInt(i.balanceDue) > 0n && !i.remindedToday && i.number);
    const paid = invoices.find((i) => i.status === "issued" && BigInt(i.balanceDue) === 0n && i.number);
    const voided = invoices.find((i) => i.status === "void" && i.number);
    expect(eligible && paid && voided, "the demo data has an unpaid, a paid and a void invoice").toBeTruthy();

    await page.goto("/invoices");
    for (const invoice of [eligible!, paid!, voided!]) await tick(page, invoice);

    const bar = page.getByRole("region", { name: "Selected invoices" });
    await expect(bar).toContainText("3 selected");
    await expect(bar).toContainText("outstanding");
    await expect(bar.getByRole("button", { name: "Send reminders (1)" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Clear" })).toBeVisible();

    await bar.getByRole("button", { name: "Send reminders (1)" }).click();
    await expect(page.getByText("1 reminder sent").first()).toBeVisible();
    await expect(page.getByText(new RegExp(`${paid!.number}: Nothing is owed on it\\.`)).first()).toBeVisible();
    await expect(page.getByText(new RegExp(`${voided!.number}: It's void\\.`)).first()).toBeVisible();
    await expect(bar).toHaveCount(0);

    // Reminded today now: it no longer counts.
    await tick(page, eligible!);
    await expect(page.getByRole("region", { name: "Selected invoices" }).getByRole("button", { name: "Send reminders (0)" })).toBeDisabled();
    await page.getByRole("region", { name: "Selected invoices" }).getByRole("button", { name: "Clear" }).click();
    await expect(page.getByRole("region", { name: "Selected invoices" })).toHaveCount(0);
  });

  test("without 'Send a payment reminder', the bar has no Send reminders button", async ({ page, seededOrg: _, browser }) => {
    await setReminderGrant(page, false);
    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto("/invoices");
    await staff.getByRole("checkbox", { name: /^Select / }).first().check();
    const bar = staff.getByRole("region", { name: "Selected invoices" });
    await expect(bar).toContainText("1 selected");
    await expect(bar.getByRole("button", { name: /Send reminders/ })).toHaveCount(0);
    await context.close();
    await setReminderGrant(page, true);
  });
});
