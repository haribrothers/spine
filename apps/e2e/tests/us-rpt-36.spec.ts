import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext } from "@playwright/test";
import { test, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

/** As the Owner, grant or revoke the default Team's "View financial statements" and "View ledger / journals". */
async function grant(request: APIRequestContext, statements: boolean) {
  const teams = (await (await request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
  const team = teams.find((t) => t.isDefault)!;
  const res = await request.put(`${API_URL}/org/teams/${team.id}/privileges`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { privileges: [{ capability: "reports.view_financial_statements", granted: statements }, { capability: "ledger.view", granted: false }] },
  });
  expect(res.ok()).toBe(true);
}

test.describe("US-RPT-36", () => {
  test("with 'View financial statements' a Staff member reads the statements, read-only; without it they see why not", async ({ page, seededOrg: _, browser }) => {
    await page.goto("/team/teams");
    await grant(page.request, true);

    const staff = await (await browser.newContext()).newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await staff.goto("/reports");
    const main = staff.getByRole("main");
    for (const name of ["Profit & Loss", "Balance Sheet", "Trial Balance", "Cash Flow", "Tax Summary"]) await expect(main.getByRole("link", { name, exact: true })).toBeVisible();

    await staff.goto("/reports/profit-and-loss");
    await expect(staff.getByRole("heading", { name: "Profit & Loss", level: 1 })).toBeVisible();
    await expect(staff.getByText("Total income")).toBeVisible();
    // No "View ledger / journals": figures aren't drill-down links.
    await expect(main.getByRole("button", { name: /^4\d{3} — / })).toHaveCount(0);

    await staff.goto("/reports/tax-summary");
    await expect(staff.getByRole("heading", { name: "Tax Summary", level: 1 })).toBeVisible();
    await expect(staff.getByRole("button", { name: "Record tax payment" })).toHaveCount(0);

    await grant(page.request, false);
    await staff.goto("/reports/profit-and-loss");
    await expect(staff.getByTestId("no-access")).toContainText("You don't have access to financial statements. Ask an owner.");
    await staff.context().close();
  });
});
