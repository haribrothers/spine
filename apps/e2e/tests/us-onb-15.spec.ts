import { randomUUID } from "node:crypto";
import { expect, test, logIn } from "./fixtures";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user, in `seededOrg`. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

test.describe("US-ONB-15", () => {
  test("an Owner opens Set up Spine from the user menu, sees what's left and marks a card not needed", async ({ page }) => {
    await signUpNewOrg(page, { name: "Setup Owner", email: `e2e-onb-15-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.getByRole("button", { name: /Setup Owner/ }).last().click();
    await page.getByRole("menuitem", { name: "Set up Spine" }).click();
    await page.waitForURL("**/setup");

    await expect(page.getByRole("heading", { name: "Set up Spine", level: 1 })).toBeVisible();
    const steps = page.getByRole("list", { name: "Setup steps" });
    for (const title of ["Business details and logo", "Tax", "Chart of accounts", "Opening balances", "Bank and cash accounts", "Payment instructions", "Documents and emails", "Numbering", "Payment reminders", "Modules", "Invite your team", "Email sending", "Backups", "Field app"]) {
      await expect(steps.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("setup-card-business")).toContainText("To do");
    await expect(page.getByTestId("setup-card-backups")).toContainText("Spine can't check backups yet");
    await expect(page.getByTestId("setup-card-backups")).not.toContainText("To do");
    const done = page.getByTestId("setup-done");
    await expect(done).toContainText(/of 13/);
    await expectNoAxeViolations(page);

    await page.getByTestId("setup-card-reminders").getByRole("button", { name: "Mark as not needed" }).click();
    await expect(page.getByTestId("setup-card-reminders")).toHaveCount(0);
    const notNeeded = page.getByRole("region", { name: "Not needed" });
    await expect(notNeeded.getByText("Payment reminders")).toBeVisible();
    await expect(done).toContainText(/of 12/);
    await notNeeded.getByRole("button", { name: "Show again" }).click();
    await expect(page.getByTestId("setup-card-reminders")).toBeVisible();
  });

  test("once the first three steps are done, the dashboard says what's left and links here", async ({ page }) => {
    await signUpNewOrg(page, { name: "Checklist Owner", email: `e2e-onb-15b-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const post = async <T>(path: string, data?: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    const contact = await post<{ id: string }>("/contacts", { type: "customer", isCompany: true, name: "First customer", email: "first.customer@example.com" });
    await post("/catalog-items", { name: "Consulting", unit: "hour", defaultPriceAmount: "10000", defaultPriceCurrency: "USD" });
    const quote = await post<{ id: string }>("/quotes", { contactId: contact.id, currency: "USD", lines: [{ type: "item", name: "Consulting", quantity: 1, unitPriceAmount: "10000" }] });
    await post(`/quotes/${quote.id}/send`);

    await page.goto("/dashboard");
    const card = page.getByTestId("finish-setting-up");
    await expect(card.getByText(/^Finish setting up Spine — \d+ left$/)).toBeVisible();
    await card.getByRole("link", { name: "Set up Spine" }).click();
    await page.waitForURL("**/setup");
  });

  test("Staff get the no-access page and no menu item", async ({ page, seededOrg: _ }) => {
    await page.goto("about:blank");
    await page.context().clearCookies();
    await logIn(page, DEMO_STAFF_USER);
    await page.getByRole("button", { name: /Sarah Mendes/ }).last().click();
    // US-SET-30: Settings is for everyone now (Your account only, for Staff).
    await expect(page.getByRole("menuitem", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Set up Spine" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.goto("/setup");
    await expect(page.getByTestId("no-access")).toContainText("Set up Spine is only available to owners.");
  });
});

test.describe("US-ONB-16", () => {
  test("each card goes to its setting, page or guide; closing a setting comes back with the card updated", async ({ page }) => {
    await signUpNewOrg(page, { name: "Card Owner", email: `e2e-onb-16-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.goto("/setup");

    // A Settings pane opens over the page; saving it and closing turns the card Done.
    const business = page.getByTestId("setup-card-business");
    await business.getByRole("button", { name: "Set up" }).click();
    const dialog = page.getByRole("dialog");
    const pane = dialog.getByTestId("settings-pane");
    await pane.getByLabel(/^Business name/).fill("Harbour Plumbing");
    await pane.getByLabel(/^Address/).fill("1 Quay Street, Auckland");
    await pane.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/setup$/);
    await expect(business).toContainText("Done");
    await expect(business.getByRole("button", { name: "Review" })).toBeVisible();

    // Email sending and Backups are set by whoever runs the server.
    await expect(page.getByTestId("setup-card-email").getByRole("link", { name: "Read the guide" })).toHaveAttribute("href", /production--self-hosting/);
    await expect(page.getByTestId("setup-card-backups").getByRole("link", { name: "Read the guide" })).toHaveAttribute("href", /production--self-hosting/);
    // The bundled guide arrives in Phase 11 (US-SITE-11).
    await expect(page.getByRole("link", { name: "How it works" })).toHaveCount(0);

    // A page card goes to its page.
    await page.getByTestId("setup-card-bank_accounts").getByRole("link", { name: "Set up" }).click();
    await page.waitForURL("**/banking");
  });
});
