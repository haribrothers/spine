import { randomUUID } from "node:crypto";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

test.describe("US-SET-11", () => {
  test("Owners see every change with filters, record links and paging; Staff get no access", async ({ page, seededOrg: _, browser }) => {
    // A role change to find: promote and demote the demo Staff user.
    const members = (await (await page.request.get(`${API_URL}/org/members`)).json()) as { id: string; email: string }[];
    const sarah = members.find((m) => m.email === DEMO_STAFF_USER.email)!;
    for (const step of ["promote", "demote"]) {
      expect((await page.request.put(`${API_URL}/org/members/${sarah.id}/${step}`, { headers: { "Idempotency-Key": randomUUID() } })).ok()).toBe(true);
    }

    await page.goto("/team/audit-log");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByText(/^Every change to records in .+, newest first\. Only owners can see this page\.$/)).toBeVisible();
    const table = page.getByTestId("audit-table");
    for (const col of ["When", "Who", "Action", "Record", "Details"]) await expect(table.getByRole("columnheader", { name: col })).toBeVisible();
    await expect(table.locator("tbody tr").first()).toBeVisible();

    // Filter to role changes on users.
    await page.getByRole("combobox", { name: "Record type" }).click();
    await page.getByRole("option", { name: "User", exact: true }).click();
    await page.getByRole("combobox", { name: "Action" }).click();
    await page.getByRole("option", { name: "Role changed" }).click();
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(table.locator("tbody tr").first()).toContainText("Owner → Staff");
    await expect(table.locator("tbody tr").first()).toContainText("User · Sarah Mendes");
    await expect(page.getByTestId("audit-range")).toHaveText("1–2 of 2 entries");

    // A record link opens the record.
    await page.getByRole("combobox", { name: "Record type" }).click();
    await page.getByRole("option", { name: "All types" }).click();
    await page.getByRole("combobox", { name: "Action" }).click();
    await page.getByRole("option", { name: "All actions" }).click();
    const invoiceLink = table.getByRole("link", { name: /^Invoice · / }).first();
    if (await invoiceLink.count()) {
      await invoiceLink.click();
      await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/);
      await page.goBack();
    }

    // More than 50: paging.
    await page.goto("/team/audit-log");
    const range = page.getByTestId("audit-range");
    await expect(range).toHaveText(/^1–\d+ of [\d,]+ entr(y|ies)$/);
    const total = Number((await range.textContent())!.match(/of ([\d,]+)/)![1]!.replace(/,/g, ""));
    if (total > 50) {
      await expect(range).toHaveText(`1–50 of ${total.toLocaleString()} entries`);
      await page.getByRole("button", { name: "Next" }).click();
      await expect(range).toHaveText(new RegExp(`^51–\\d+ of ${total.toLocaleString()} entries$`));
      await page.getByRole("button", { name: "Previous" }).click();
      await expect(range).toHaveText(/^1–50 of/);
    }

    // Staff: the no-access page.
    const context = await browser.newContext();
    const staffPage = await context.newPage();
    await logIn(staffPage, DEMO_STAFF_USER);
    await staffPage.goto("/team/audit-log");
    await expect(staffPage.getByTestId("audit-table")).toHaveCount(0);
    await expect(staffPage.getByText(/only owners|don't have access|can't open/i).first()).toBeVisible();
    await context.close();
  });
});
