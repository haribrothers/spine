import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { sendQuoteAndGetPublicLink, signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-QUO-21", () => {
  test("a revised quote's old link shows the business and how to reach it", async ({ page, browser }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-quo-21-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const profile = { name: "Riverstone Builders", address: "14 Harbour Road, Marina District", email: "hello@riverstone.example", phone: "+1 555 0100" };
    const saved = await page.request.put(`${API_URL}/org/settings/business_profile`, { headers: { "Idempotency-Key": randomUUID() }, data: { value: profile } });
    expect(saved.ok()).toBe(true);

    const link = await sendQuoteAndGetPublicLink(page, { contactName: "Alan Brooks", contactEmail: `alan-${randomUUID()}@example.com` });
    const quoteId = page.url().split("/").pop()!;
    const revised = await page.request.post(`${API_URL}/quotes/${quoteId}/revise`, { headers: { "Idempotency-Key": randomUUID() } });
    expect(revised.ok()).toBe(true);

    const customer = await browser.newPage();
    await customer.goto(link);
    const card = customer.getByTestId("quote-link-expired");
    await expect(card).toContainText("This quote link has expired");
    await expect(card).toContainText(
      "The link you opened is no longer active — the quote may have been updated or replaced. Contact Riverstone Builders and they'll send you the latest version.",
    );
    await expect(card).toContainText("14 Harbour Road, Marina District");
    await expect(card.getByRole("link", { name: "hello@riverstone.example" })).toHaveAttribute("href", "mailto:hello@riverstone.example");
    await expect(card.getByRole("link", { name: "+1 555 0100" })).toHaveAttribute("href", "tel:+15550100");
    await customer.close();
  });

  test("a link that matches nothing shows 'This quote link isn't valid' and no business", async ({ page }) => {
    await page.goto(`/quote/${randomUUID()}`);
    const card = page.getByTestId("quote-link-invalid");
    await expect(card).toContainText("This quote link isn't valid");
    await expect(page.getByTestId("quote-link-expired")).toHaveCount(0);
  });
});
