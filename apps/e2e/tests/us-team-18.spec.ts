import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user, in the default Team. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

/**
 * The sidebar's links, by label, in order (only nav links carry `aria-label`), once `ready`
 * shows — a link that appears only after the person's permissions load.
 */
async function sidebarLinks(page: Page, ready: string): Promise<string[]> {
  await expect(page.locator(`a[aria-label="${ready}"]`)).toBeVisible({ timeout: 15_000 });
  return page.locator('a[aria-label][href^="/"]').evaluateAll((links) => links.map((link) => link.getAttribute("aria-label") ?? ""));
}

test.describe("US-TEAM-18", () => {
  test("a Field user's sidebar shows only Dashboard, Jobs, Meetings and Expenses", async ({ seededOrg, browser }) => {
    void seededOrg;
    const context = await browser.newContext();
    const page = await context.newPage();
    await logIn(page, DEMO_FIELD_USER);
    const links = await sidebarLinks(page, "Jobs");
    expect(links.filter((l) => ["Dashboard", "Jobs", "Meetings", "Expenses"].includes(l))).toEqual(["Dashboard", "Jobs", "Meetings", "Expenses"]);
    for (const hidden of ["Invoices", "Credit Notes", "Payments", "Receivables", "Vendor Bills", "Payables", "Reports", "Users", "Teams", "Contacts", "Quotes"]) {
      expect(links, hidden).not.toContain(hidden);
    }
    await expect(page.getByText("Work", { exact: true })).toBeVisible();
    await context.close();
  });

  test("Staff without the report grants don't see Receivables, Payables, Reports or Team", async ({ page, seededOrg, browser }) => {
    void seededOrg;
    // The Owner turns every report capability off for the default Team.
    const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
    const defaultTeam = teams.find((t) => t.isDefault)!;
    const res = await page.request.put(`${API_URL}/org/teams/${defaultTeam.id}/privileges`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: {
        privileges: ["reports.view_dashboard_summary", "reports.view_receivables", "reports.view_payables", "reports.view_job_profitability"].map(
          (capability) => ({ capability, granted: false }),
        ),
      },
    });
    expect(res.ok()).toBe(true);

    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    const links = await sidebarLinks(staff, "Contacts");
    for (const shown of ["Dashboard", "Contacts", "Quotes", "Jobs", "Invoices", "Expenses"]) expect(links, shown).toContain(shown);
    for (const hidden of ["Receivables", "Payables", "Reports", "Users", "Teams"]) expect(links, hidden).not.toContain(hidden);
    await context.close();
  });

  test("an Owner sees every section, including Team", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/dashboard");
    const links = await sidebarLinks(page, "Teams");
    for (const shown of ["Receivables", "Payables", "Reports", "Users", "Teams"]) expect(links, shown).toContain(shown);
  });
});
