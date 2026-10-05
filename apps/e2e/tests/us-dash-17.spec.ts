import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user, in the default Team. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

async function setGrant(page: Page, capability: string, granted: boolean) {
  const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
  const res = await page.request.put(`${API_URL}/org/teams/${teams.find((t) => t.isDefault)!.id}/privileges`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { privileges: [{ capability, granted }] },
  });
  expect(res.ok()).toBe(true);
}

test.describe("US-DASH-17", () => {
  test("Staff see only what they can act on, their own KPI set, and no Team section", async ({ page, seededOrg: _, browser }) => {
    // The Owner takes the dashboard summary away from the default Team.
    await setGrant(page, "reports.view_dashboard_summary", false);

    const staffContext = await browser.newContext();
    const staffPage = await staffContext.newPage();
    await logIn(staffPage, DEMO_STAFF_USER);

    // A follow-up of Sarah's, already overdue.
    const contacts = (await (await staffPage.request.get(`${API_URL}/contacts`)).json()) as { id: string }[];
    const res = await staffPage.request.post(`${API_URL}/activities`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { contactId: contacts[0]!.id, type: "call", notes: "Call back Priya Nair", dueAt: new Date(Date.now() - 3_600_000).toISOString() },
    });
    expect(res.ok()).toBe(true);

    await staffPage.goto("/dashboard");
    const attention = staffPage.getByTestId("attention-card");
    await expect(attention.getByText("Only things you can act on")).toBeVisible({ timeout: 15_000 });
    const followups = attention.locator('li[data-kind="followups_overdue"]');
    await expect(followups).toContainText(/follow-ups? (is|are) overdue/);
    await expect(followups).toContainText("Call back Priya Nair");

    const kpis = staffPage.getByTestId("kpi-row");
    await expect(kpis.locator('[data-kpi="receivables"]')).toContainText("Receivables");
    await expect(kpis.locator('[data-kpi="overdue"]')).toContainText("Overdue");
    await expect(kpis.locator('[data-kpi="pipeline"]')).toContainText("Open pipeline");
    await expect(kpis.locator('[data-kpi="quotes_won"]')).toContainText("Quotes won this month");
    await expect(kpis.locator('[data-kpi="cash"]')).toHaveCount(0);
    await expect(staffPage.getByText("Money in and out")).toHaveCount(0);

    // US-TEAM-18: no Team section in the sidebar.
    await expect(staffPage.getByRole("link", { name: "Invoices", exact: true })).toBeVisible();
    await expect(staffPage.getByRole("link", { name: "Teams", exact: true })).toHaveCount(0);
    await expect(staffPage.getByRole("link", { name: "Users", exact: true })).toHaveCount(0);

    // "Open" goes to the oldest follow-up's contact.
    await followups.getByRole("link", { name: "Open" }).click();
    await expect(staffPage).toHaveURL(/\/contacts\/[0-9a-f-]+$/);

    await staffContext.close();
    await setGrant(page, "reports.view_dashboard_summary", true);
  });
});
