import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { sendQuoteAndGetPublicLink, signUpNewOrg, waitForEmail } from "./helpers";

test.describe("US-NTF-10", () => {
  test("the quote email uses the branded layout with the quote's key facts", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-ntf-10-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const contactEmail = `alan-${randomUUID()}@example.com`;
    const link = await sendQuoteAndGetPublicLink(page, { contactName: "Alan Brooks", contactEmail, unitPrice: "510" });
    expect(link).toContain("/quote/");

    const email = await waitForEmail((e) => e.to.some((t) => t.address === contactEmail));
    expect(email.subject).toMatch(/sent you a quote \(QUO-\d{4}\)$/);
    const html = email.html ?? "";
    expect(html).toContain("border-top:6px solid");
    expect(html).toContain("Your quote is ready");
    expect(html).toContain("Hi Alan,");
    for (const label of ["Quote", "Total", "510.00 USD", "View quote"]) expect(html).toContain(label);
    expect(email.text).toContain("Your quote is ready");
    expect(email.text).toContain("View quote: ");
  });
});
