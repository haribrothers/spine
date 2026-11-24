import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { test as seeded, logIn } from "./fixtures";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

test.describe("US-RPT-22", () => {
  test("empty at first; then cards, newest first and a status filter", async ({ page }) => {
    await signUpNewOrg(page, { name: "List Owner", email: `e2e-rpt-22-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.goto("/journals");
    await expect(page.getByText("No journals yet. Most businesses only need one for year-end adjustments.")).toBeVisible();

    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const ids: string[] = [];
    for (const [date, reason, amount] of [["2026-06-30", "Year-end accruals (from accountant)", "482000"], ["2026-09-30", "Depreciation for September", "65000"]] as const) {
      const res = await page.request.post(`${API_URL}/manual-journals`, {
        headers: { "Idempotency-Key": randomUUID() },
        data: { date, reason, lines: [{ accountId: code("6900"), debit: amount, credit: "0" }, { accountId: code("1510"), debit: "0", credit: amount }] },
      });
      ids.push(((await res.json()) as { id: string }).id);
    }
    await page.request.post(`${API_URL}/manual-journals/${ids[1]}/reverse`, { headers: { "Idempotency-Key": randomUUID() }, data: { date: "2026-10-03", reason: "Wrong account" } });

    await page.reload();
    const cards = page.getByTestId("journal-cards");
    await expect(cards).toContainText("Total journals2");
    await expect(cards).toContainText("Posted1");
    await expect(cards).toContainText("Reversed1");
    const table = page.getByTestId("journals-table");
    await expect(table.getByRole("row").nth(1)).toContainText("JNL-0002");
    await expect(table.getByRole("row").nth(1)).toContainText("Reversed");
    await expect(table.getByRole("row").nth(2)).toContainText("Year-end accruals (from accountant)");
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Reversed" }).click();
    await expect(table).toContainText("JNL-0002");
    await expect(table).not.toContainText("JNL-0001");
    await expect(page.getByText('Members with "View ledger / journals" can read journals; only owners post or reverse them.')).toBeVisible();
  });
});

seeded.describe("US-RPT-22 read-only", () => {
  seeded("a member with 'View ledger / journals' reads journals but can't post or reverse", async ({ page, seededOrg: _, browser }) => {
    const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
    const generalStaff = teams.find((t) => t.isDefault)!;
    const grant = (granted: boolean) => page.request.put(`${API_URL}/org/teams/${generalStaff.id}/privileges`, { headers: { "Idempotency-Key": randomUUID() }, data: { privileges: [{ capability: "ledger.view", granted }] } });
    const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
    const code = (c: string) => Object.values(grouped).flat().find((a) => a.code === c)!.id;
    const res = await page.request.post(`${API_URL}/manual-journals`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { date: new Date().toISOString().slice(0, 10), reason: "Staff-visible journal", lines: [{ accountId: code("6900"), debit: "100", credit: "0" }, { accountId: code("1510"), debit: "0", credit: "100" }] },
    });
    const journal = (await res.json()) as { id: string };

    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await expect(staff.getByRole("link", { name: "Journals" })).toHaveCount(0);
    expect((await grant(true)).ok()).toBe(true);
    await staff.goto("/journals");
    await expect(staff.getByTestId("journals-table")).toContainText("Staff-visible journal");
    await expect(staff.getByRole("button", { name: "New journal" })).toHaveCount(0);
    await staff.goto(`/journals/${journal.id}`);
    await expect(staff.getByRole("heading", { name: /^JNL-/ })).toBeVisible();
    await expect(staff.getByRole("button", { name: "Reverse", exact: true })).toHaveCount(0);
    await expect(staff.getByRole("button", { name: "Copy to new journal" })).toHaveCount(0);
    await context.close();
    expect((await grant(false)).ok()).toBe(true);
  });
});
