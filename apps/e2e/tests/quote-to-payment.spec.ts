import { expect, test } from "@playwright/test";
import { clearInbox, extractLink, signUpNewOrg, waitForEmail } from "./helpers";

/**
 * Spine's testing-expectations section: "E2E smoke test covering
 * quote → invoice → payment." Drives the real UI end to end against real
 * apps/api + apps/web instances (see playwright.config.ts's own comment) —
 * no mocked network calls, no backdoor for the quote's public link (read
 * from the actual email MailDev received, same as a real customer would
 * get it).
 *
 * One long test rather than several independent ones — each stage
 * depends on state the previous stage created (the quote's id, the
 * invoice it converts into, etc.), so splitting it up would mean either
 * re-deriving that state via extra setup or coupling tests via shared
 * mutable state, both worse than one linear scenario for a smoke test
 * whose entire point is proving the full chain works together.
 */
test("quote → send → customer accepts → convert to invoice → issue → record payment", async ({ page, context }) => {
  const stamp = Date.now();
  const ownerEmail = `e2e-owner-${stamp}@example.com`;
  const customerName = `E2E Customer ${stamp}`;

  await signUpNewOrg(page, { name: "E2E Owner", email: ownerEmail, password: "e2e-test-password-1" });

  // --- Contact ---
  await page.goto("/contacts");
  await page.getByRole("button", { name: "Add contact" }).first().click();
  await page.getByLabel("Full name").fill(customerName);
  await page.getByLabel("Email").fill(`customer-${stamp}@example.com`);
  await page.getByRole("button", { name: "Save contact" }).click();
  await expect(page.getByText(customerName).first()).toBeVisible();

  // --- Quote ---
  await page.goto("/quotes/new");
  await page.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
  await page.getByPlaceholder("Search…").fill(customerName);
  await page.getByRole("option", { name: customerName }).click();

  await page.getByPlaceholder("Item name").fill("Consulting services");
  const unitPriceInput = page.getByLabel("Unit price").first();
  await unitPriceInput.fill("1000");

  await page.getByRole("button", { name: /Save as draft/ }).click();
  await page.waitForURL(/\/quotes\/[a-f0-9-]+$/);

  const quoteUrl = page.url();
  const quoteId = quoteUrl.split("/").pop()!;

  await clearInbox();
  await page.getByRole("button", { name: "Send Quote" }).click();
  // US-SET-21: the send dialog starts from the Quote email template.
  await page.getByRole("dialog").getByRole("button", { name: "Send quote" }).click();
  await expect(page.getByText(/^sent$/i).first()).toBeVisible({ timeout: 10_000 });

  // --- Customer accepts via the real emailed public link ---
  const email = await waitForEmail((e) => e.to.some((t) => t.address === `customer-${stamp}@example.com`));
  const publicLink = extractLink(email);

  const customerPage = await context.newPage();
  await customerPage.goto(publicLink);
  await expect(customerPage.getByText("Consulting services")).toBeVisible();
  await customerPage.getByRole("button", { name: "Accept quote" }).click();
  await expect(customerPage.getByText(/accepted/i).first()).toBeVisible({ timeout: 10_000 });
  await customerPage.close();

  // --- Back in the owner session: convert to invoice ---
  await page.goto(`/quotes/${quoteId}`);
  await page.reload();
  await expect(page.getByText(/^accepted$/i).first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Convert to invoice" }).click();
  // D-218: converting asks first.
  await page.getByRole("alertdialog", { name: "Convert to an invoice?" }).getByRole("button", { name: "Convert to invoice" }).click();
  await page.waitForURL(/\/invoices\/[a-f0-9-]+$/);

  // --- Issue the invoice ---
  await page.getByRole("button", { name: "Issue invoice" }).click();
  // Issuing can't be undone, so it asks first (D-217).
  await page.getByRole("alertdialog", { name: "Issue this invoice?" }).getByRole("button", { name: "Issue invoice" }).click();
  await expect(page.getByText("Invoice issued", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // --- Record a full payment (the dialog pre-fills amount + allocation
  // from the invoice's own outstanding balance, so nothing to fill in) ---
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Record a payment")).toBeVisible();
  // The dialog loads the customer's open invoices and ticks this one (US-PAY-23) —
  // wait for that before submitting, or the payment would go in as credit.
  await expect(page.getByTestId("record-payment-summary")).toContainText("nothing becomes credit", { timeout: 10_000 });
  await page.getByRole("button", { name: "Record payment" }).last().click();

  // Invoices have no "paid" status of their own (draft/issued/void only —
  // "paid" is derived from balanceDue reaching zero, not a stored status).
  // The real signal: once fully paid, "Record payment" is no longer
  // offered (InvoiceDetail's own canRecordPayment = balanceDue > 0n), and
  // the Balance due figure reads $0.00 (US-INV-30).
  await expect(page.getByRole("button", { name: "Record payment" })).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByTestId("fig-balance")).toContainText(/Balance due\D*0\.00/, { timeout: 10_000 });
});
