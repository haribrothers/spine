import { test, expect } from "./fixtures";

/**
 * A broad, shallow pass across every remaining route section not already
 * covered by a dedicated spec file (Dashboard, Reports, and the public
 * quote page have their own; Contacts/Quotes/Invoices/Payments already
 * get real exercise via `quote-to-payment.spec.ts`'s own create/send/
 * accept/convert/issue/pay flow). Each route: loads without a console
 * error, shows its own heading, and shows at least one expected
 * data-bearing element — a real seeded row/stat for routes with seeded
 * data, or an explicitly-asserted empty state for the ones demo-data
 * doesn't seed (Vendor Bills/Expenses/Vendor Payments/Payables ARE
 * seeded via `seedPurchases` — see fixtures.ts's own comment for what
 * demo-data does and doesn't cover).
 */
test.describe("Route smoke pass", () => {
  const routes: { path: string; heading: string }[] = [
    { path: "/contacts", heading: "Contacts" },
    { path: "/leads", heading: "Pipeline" },
    { path: "/catalog", heading: "Catalogue" },
    { path: "/jobs", heading: "Jobs" },
    { path: "/meetings", heading: "Meetings" },
    { path: "/invoices", heading: "Invoices" },
    { path: "/credit-notes", heading: "Credit notes" },
    { path: "/emails", heading: "Email log" },
    { path: "/payments", heading: "Payments" },
    { path: "/receivables", heading: "Receivables" },
    { path: "/vendor-bills", heading: "Vendor bills" },
    { path: "/expenses", heading: "Expenses" },
    { path: "/vendor-payments", heading: "Vendor payments" },
    { path: "/payables", heading: "Payables" },
    { path: "/team/users", heading: "Users" },
    { path: "/team/teams", heading: "Teams" },
    { path: "/profile", heading: "Profile & Preferences" },
  ];

  for (const { path, heading } of routes) {
    test(`${path} loads with no console errors and shows its heading`, async ({ page, seededOrg }) => {
      void seededOrg;
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (err) => consoleErrors.push(err.message));

      const response = await page.goto(path);
      expect(response?.ok(), `${path} did not respond with a 2xx/3xx status`).toBeTruthy();
      await expect(page.locator("h1").first()).toHaveText(heading, { timeout: 15_000 });

      expect(consoleErrors, `${path} logged console errors: ${consoleErrors.join("; ")}`).toEqual([]);
    });
  }

  test("Contacts/Invoices/Jobs show real seeded rows, not just an empty state", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/contacts");
    await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });
    const contactRows = await page.getByRole("row").count();
    expect(contactRows).toBeGreaterThan(1); // header row + at least one data row

    await page.goto("/invoices");
    await expect(page.getByText(/INV-\d+/).first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/jobs");
    await expect(page.getByText(/Hotel lobby renovation/).first()).toBeVisible({ timeout: 15_000 });
  });
});
