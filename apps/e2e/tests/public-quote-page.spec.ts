import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { signUpNewOrg, sendQuoteAndGetPublicLink } from "./helpers";

/**
 * The public quote page (`/quote/[token]`) was flagged in CHANGELOG as
 * "the actual rendered UI was not visually verified in a browser — no
 * browser-automation tooling exists in this environment," only checked
 * via curl against the live endpoints and a build-compiles check. This
 * suite closes that gap: real rendering, plus accept/reject/already-
 * resolved/invalid-token states — `quote-to-payment.spec.ts`'s own smoke
 * test already covers the accept path end-to-end into an invoice, so
 * this file focuses on the states that test doesn't touch.
 *
 * Each test signs up its own fresh org (no demo-data seed needed — the
 * public page doesn't depend on report/dashboard data) and sends its own
 * quote via `sendQuoteAndGetPublicLink`, since each scenario needs a
 * distinct, freshly-issued token.
 */
test.describe("Public quote page", () => {
  test("renders the quote and lets the customer decline it", async ({ page }) => {
    const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
    await signUpNewOrg(page, { name: "E2E Owner", email: `e2e-owner-${stamp}@example.com`, password: "e2e-test-password-1" });
    const publicLink = await sendQuoteAndGetPublicLink(page, {
      contactName: `E2E Decline Customer ${stamp}`,
      contactEmail: `decline-${stamp}@example.com`,
    });

    const customerPage = await page.context().newPage();
    await customerPage.goto(publicLink);

    await expect(customerPage.getByText("Consulting services")).toBeVisible();
    await expect(customerPage.getByText("Awaiting your response")).toBeVisible();
    await expect(customerPage.getByText("Subtotal")).toBeVisible();
    await expect(customerPage.getByText("Total", { exact: true })).toBeVisible();
    await expect(customerPage.getByRole("button", { name: "Accept quote" })).toBeVisible();
    await expect(customerPage.getByRole("button", { name: "Decline" })).toBeVisible();

    await customerPage.getByRole("button", { name: "Decline" }).click();
    await expect(customerPage.getByText(/You rejected this quote/)).toBeVisible({ timeout: 10_000 });
    // Once resolved, the accept/decline buttons are gone — nothing left to decide.
    await expect(customerPage.getByRole("button", { name: "Accept quote" })).toHaveCount(0);
    await expect(customerPage.getByRole("button", { name: "Decline" })).toHaveCount(0);

    await customerPage.close();
  });

  test("an already-resolved quote shows its resolution, not the decision buttons, on a fresh visit", async ({ page }) => {
    const stamp = `${Date.now()}-${randomUUID().slice(0, 6)}`;
    await signUpNewOrg(page, { name: "E2E Owner", email: `e2e-owner-${stamp}@example.com`, password: "e2e-test-password-1" });
    const publicLink = await sendQuoteAndGetPublicLink(page, {
      contactName: `E2E Resolved Customer ${stamp}`,
      contactEmail: `resolved-${stamp}@example.com`,
    });

    const customerPage = await page.context().newPage();
    await customerPage.goto(publicLink);
    await customerPage.getByRole("button", { name: "Accept quote" }).click();
    await expect(customerPage.getByText(/You accepted this quote/)).toBeVisible({ timeout: 10_000 });

    // Re-visit the SAME link fresh (e.g. the customer clicks the email
    // link again days later) — the resolved state must be what a GET
    // returns on its own, not just what stayed on screen after the
    // in-page POST response.
    await customerPage.goto(publicLink);
    await expect(customerPage.getByText("Accepted", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(customerPage.getByText(/You accepted this quote/)).toBeVisible();
    await expect(customerPage.getByRole("button", { name: "Accept quote" })).toHaveCount(0);
    await expect(customerPage.getByRole("button", { name: "Decline" })).toHaveCount(0);

    await customerPage.close();
  });

  test("an invalid token shows a clear error, not a blank page", async ({ page }) => {
    await page.goto("/quote/this-is-not-a-real-token");
    await expect(page.getByText("This quote link isn't valid")).toBeVisible({ timeout: 10_000 });
  });
});
