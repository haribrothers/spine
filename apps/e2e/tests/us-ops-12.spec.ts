import { randomUUID } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect, logIn, DEMO_FIELD_USER } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };
const REPORT_CAPABILITIES = ["reports.view_dashboard_summary", "reports.view_receivables", "reports.view_payables", "reports.view_job_profitability"];

/** As the Owner, set the default Team's report grants. */
async function setReportGrants(request: APIRequestContext, granted: Record<string, boolean>) {
  const teams = (await (await request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
  const team = teams.find((t) => t.isDefault)!;
  const res = await request.put(`${API_URL}/org/teams/${team.id}/privileges`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { privileges: REPORT_CAPABILITIES.map((capability) => ({ capability, granted: granted[capability] ?? false })) },
  });
  expect(res.ok()).toBe(true);
}

async function asUser(browser: import("@playwright/test").Browser, user: { email: string; password: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await logIn(page, user);
  return page;
}

test.describe("US-OPS-12", () => {
  test("a Staff member without report grants sees why Reports won't open, and no report data is requested", async ({ page, seededOrg, browser }) => {
    void seededOrg;
    await setReportGrants(page.request, {});
    const staff = await asUser(browser, DEMO_STAFF_USER);
    const reportCalls: string[] = [];
    // Only requests made while a refused page is open count (the dashboard
    // shown after login loads its own widgets, which gate themselves).
    staff.on("request", (req) => {
      const onRefusedPage = /\/(reports|receivables)(\/|$)/.test(new URL(staff.url()).pathname);
      if (onRefusedPage && req.url().startsWith(`${API_URL}/reports`)) reportCalls.push(req.url());
    });

    await staff.goto("/reports");
    const noAccess = staff.getByTestId("no-access");
    await expect(noAccess).toContainText("You don't have access to Reports");
    await expect(noAccess).toContainText(
      "Your account can't open this page. If you need it for your work, ask an owner — E2E Seeded Owner — to change your team's permissions.",
    );
    expect(reportCalls).toEqual([]);

    await staff.goto("/receivables");
    await expect(staff.getByTestId("no-access")).toContainText("You don't have access to Receivables");
    expect(reportCalls).toEqual([]);

    // The dashboard's own widgets load (and gate) themselves, so stop watching here.
    await staff.getByTestId("no-access").getByRole("link", { name: "Go to dashboard" }).click();
    await staff.waitForURL("**/dashboard");
    await staff.context().close();
  });

  test("Owner-only pages say so, with no suggestion to change Team permissions", async ({ page, seededOrg, browser }) => {
    void seededOrg;
    await setReportGrants(page.request, { "reports.view_job_profitability": true });
    const staff = await asUser(browser, DEMO_STAFF_USER);

    await staff.goto("/team/users");
    await expect(staff.getByTestId("no-access")).toContainText("Team is only available to owners.");
    await expect(staff.getByTestId("no-access")).not.toContainText("team's permissions");

    await staff.goto("/reports");
    await staff.getByRole("tab", { name: "Profit & Loss" }).click();
    await expect(staff.getByTestId("no-access")).toContainText("Profit & Loss is only available to owners.");
    await staff.context().close();
  });

  test("a Field user gets the no-access page for pages outside their work", async ({ seededOrg, browser }) => {
    void seededOrg;
    const field = await asUser(browser, DEMO_FIELD_USER);
    await field.goto("/invoices");
    const noAccess = field.getByTestId("no-access");
    await expect(noAccess).toContainText("You don't have access to Invoices");
    await expect(noAccess).toContainText("ask an owner — E2E Seeded Owner.");
    await expect(noAccess).not.toContainText("team's permissions");
    await field.context().close();
  });

  test("a refused action shows a permission toast, not a raw error", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.route("**/users/me/dashboard-layout", (route) =>
      route.request().method() === "PUT" ? route.fulfill({ status: 403, json: { statusCode: 403, message: "Forbidden resource" } }) : route.continue(),
    );
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Edit layout" }).click();
    await page.getByRole("button", { name: /^Hide / }).first().click();
    await expect(page.getByTestId("permission-toast")).toContainText("You don't have permission to do that");
    await expect(page.getByText("Forbidden resource")).toHaveCount(0);
  });
});
