import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user, in the default Team. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

async function setRecurringGrant(page: Page, granted: boolean) {
  const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
  const res = await page.request.put(`${API_URL}/org/teams/${teams.find((t) => t.isDefault)!.id}/privileges`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { privileges: [{ capability: "invoices.manage_recurring", granted }] },
  });
  expect(res.ok()).toBe(true);
}

test.describe("US-INV-20", () => {
  test("the dialog asks for the schedule, refuses a past start date, and saves an Active schedule with its next date", async ({ page, seededOrg: _ }) => {
    await page.goto("/invoices");
    await page.getByRole("link", { name: "Recurring invoices" }).click();
    await expect(page.getByRole("heading", { name: "Recurring invoices" })).toBeVisible();
    await page.getByRole("button", { name: "+ New recurring invoice" }).first().click();

    const dialog = page.getByRole("dialog", { name: "New recurring invoice" });
    for (const label of ["Name", "Customer", "Repeats", "On", "Starts", "Ends", "Payment due"]) {
      await expect(dialog.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(dialog.getByRole("radio", { name: "Issue the invoice and email it to the customer" })).toBeChecked();
    await expect(dialog.getByRole("radio", { name: "Create a draft for me to review" })).toBeVisible();

    await dialog.getByRole("combobox", { name: "Repeats" }).click();
    await expect(page.getByRole("option")).toHaveText(["Weekly", "Monthly", "Every 3 months", "Yearly"]);
    await page.getByRole("option", { name: "Monthly" }).click();
    await dialog.getByRole("combobox", { name: "Ends" }).click();
    await expect(page.getByRole("option")).toHaveText(["Never", "On a date", "After a number of invoices"]);
    await page.getByRole("option", { name: "Never" }).click();

    const name = `Monthly maintenance — Hotel lobby ${randomUUID().slice(0, 4)}`;
    await dialog.getByRole("textbox", { name: "Name" }).fill(name);
    await dialog.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
    await page.getByPlaceholder("Search…").fill("Harborview");
    await page.getByRole("option", { name: /Harborview Construction Co\./ }).click();
    const item = dialog.getByRole("combobox", { name: "Item" });
    await item.click();
    await item.fill("Monthly maintenance visit");
    await page.getByRole("option", { name: "Use “Monthly maintenance visit” as a one-off line" }).click();
    await dialog.locator("div", { hasText: /^Unit price/ }).getByRole("textbox").fill("1250.00");

    // A start date last month is refused.
    await dialog.getByRole("button", { name: /\d{1,2}\/\d{1,2}\/\d{4}|Pick a date/ }).first().click();
    await page.getByRole("button", { name: "Previous month" }).click();
    await page.getByRole("gridcell").first().click();
    await dialog.getByRole("button", { name: "Save schedule" }).click();
    await expect(dialog.getByText("Pick today or a later start date.")).toBeVisible();

    await dialog.getByRole("button", { name: /\d{1,2}\/\d{1,2}\/\d{4}/ }).first().click();
    await page.getByRole("button", { name: "Next month" }).click();
    await page.locator('[role="gridcell"][aria-current="date"]').click();
    await dialog.getByRole("button", { name: "Save schedule" }).click();
    await expect(dialog).toHaveCount(0);

    const row = page.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText("Harborview Construction Co.");
    await expect(row).toContainText("Monthly · 1st");
    await expect(row).toContainText("Active");
    await expect(row).toContainText("Issue and email");
    await expect(row).toContainText("$1,250.00");
    await expect(row.getByRole("cell").nth(3)).toHaveText(/^[A-Z][a-z]{2} 1, \d{4}$/);
  });

  test("without 'Manage recurring invoices' the link is hidden and the API refuses", async ({ page, seededOrg: _, browser }) => {
    await setRecurringGrant(page, false);
    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto("/invoices");
    await expect(staff.getByRole("link", { name: "New invoice" })).toBeVisible();
    await expect(staff.getByRole("link", { name: "Recurring invoices" })).toHaveCount(0);
    expect((await staff.request.get(`${API_URL}/recurring-invoices`)).status()).toBe(403);
    await context.close();
    await setRecurringGrant(page, true);
  });
});
