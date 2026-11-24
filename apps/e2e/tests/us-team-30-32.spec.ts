import { randomUUID } from "node:crypto";
import { expectNoAxeViolations } from "./axe";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

/**
 * Closes Quotes for the demo's General Staff (Sarah Mendes is on it alone),
 * checks what Sarah sees, and puts the Team's permissions back.
 */
test.describe("US-TEAM-30 to US-TEAM-32", () => {
  test("an owner closes Quotes for a Team; its Staff no longer see it, and other pages name quotes without linking them", async ({ page, seededOrg }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; name: string }[];
    const general = teams.find((t) => t.name === "General Staff")!;
    const saved = ((await (await page.request.get(`${API_URL}/org/teams/${general.id}`)).json()) as { privileges: Record<string, boolean> }).privileges;
    const jobs = (await (await page.request.get(`${API_URL}/jobs`)).json()) as { id: string; sourceQuoteId: string | null }[];
    const jobId = jobs.find((j) => j.sourceQuoteId)!.id;
    const fromQuote = (await (await page.request.get(`${API_URL}/jobs/${jobId}`)).json()) as { id: string; sourceQuoteId: string; sourceQuoteNumber: string };
    expect(fromQuote.sourceQuoteNumber).toBeTruthy();

    try {
      // US-TEAM-32 — the Sections card, in the same draft as the groups.
      await page.goto(`/team/teams/${general.id}?tab=permissions`);
      const sections = page.getByTestId("team-sections");
      const quotes = sections.getByRole("switch", { name: "Quotes section" });
      await expect(quotes).toBeChecked();
      await quotes.click();
      await expect(quotes).not.toBeChecked();
      await expect(sections.locator('[data-section="Quotes"]')).toContainText("Can't open");
      await expect(sections.locator('[data-section="Quotes"]')).toContainText("Changed");
      await expect(page.getByTestId("privilege-notice")).toContainText("turned off too");

      // The group starts with Open Quotes; its actions wait for it.
      await page.getByRole("button", { name: "Manage Quotes" }).click();
      await expect(page.getByRole("switch", { name: "Open Quotes" })).not.toBeChecked();
      const create = page.getByRole("switch", { name: "Create/edit own quotes" });
      await expect(create).toBeDisabled();
      await expect(page.getByTestId("permissions-list")).toContainText("Open Quotes first.");
      await expect(page.getByTestId("members-will-open").getByRole("listitem").filter({ hasText: "Quotes" })).toContainText("Lost");
      await expectNoAxeViolations(page);

      await page.getByTestId("permissions-bar").getByRole("button", { name: "Save changes" }).click();
      const confirm = page.getByRole("alertdialog", { name: /Save \d+ changes to General Staff\?/ });
      await expect(confirm.getByTestId("save-permissions-list")).toContainText("Turn off Open Quotes");
      await expect(confirm.getByTestId("save-permissions-list")).toContainText("They'll no longer see Quotes");
      await confirm.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByTestId("permissions-bar")).toHaveCount(0);

      // US-TEAM-30 — Sarah: no Quotes in the sidebar, and its pages say there's no access.
      await page.goto("about:blank");
      await page.context().clearCookies();
      await logIn(page, DEMO_STAFF_USER);
      // Once the sidebar has loaded (Invoices is there), Quotes isn't.
      const sidebar = page.getByRole("complementary");
      await expect(sidebar.getByRole("link", { name: "Invoices", exact: true })).toBeVisible();
      await expect(sidebar.getByRole("link", { name: "Quotes", exact: true })).toHaveCount(0);
      await page.goto(`/quotes/${fromQuote.sourceQuoteId}`);
      await expect(page.getByTestId("no-access")).toContainText("You don't have access to Quotes");

      // US-TEAM-31 — the job names its quote as plain text, not a link.
      await page.goto(`/jobs/${fromQuote.id}`);
      const named = page.locator("[data-closed-section]").filter({ hasText: fromQuote.sourceQuoteNumber });
      await expect(named).toBeVisible();
      await expect(page.getByRole("link", { name: fromQuote.sourceQuoteNumber })).toHaveCount(0);
      await expectNoAxeViolations(page);
    } finally {
      // Put General Staff back for the other specs.
      await page.goto("about:blank");
      await page.context().clearCookies();
      await logIn(page, { email: seededOrg.ownerEmail, password: seededOrg.ownerPassword });
      const privileges = Object.entries(saved).map(([capability, granted]) => ({ capability, granted }));
      const res = await page.request.put(`${API_URL}/org/teams/${general.id}/privileges`, { headers: { "Idempotency-Key": randomUUID() }, data: { privileges } });
      expect(res.ok()).toBe(true);
    }
  });
});
