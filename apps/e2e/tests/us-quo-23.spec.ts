import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { sendQuoteAndGetPublicLink, signUpNewOrg } from "./helpers";

test.describe("US-QUO-23", () => {
  test("the repeat-conversion warning lists each job as a link and confirms with a primary button", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-quo-23-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const link = await sendQuoteAndGetPublicLink(page, { contactName: "Alan Brooks", contactEmail: `alan-${randomUUID()}@example.com` });
    const quoteUrl = page.url();

    const customer = await page.context().newPage();
    await customer.goto(link);
    await customer.getByRole("button", { name: "Accept quote" }).click();
    await expect(customer.getByText(/You accepted this quote/)).toBeVisible({ timeout: 10_000 });
    await customer.close();

    // First conversion goes straight through.
    await page.goto(quoteUrl);
    await page.getByRole("button", { name: "Convert to job" }).click();
    await page.waitForURL(/\/jobs\/[a-f0-9-]+$/);
    const firstJobUrl = page.url();

    // Second conversion warns.
    await page.goto(quoteUrl);
    await page.getByRole("button", { name: "Convert to job" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(
      "Converting again creates a separate job. The amount isn't split between them. Only do this if you mean to bill or track this quote's work more than once.",
    );
    const jobs = dialog.getByTestId("existing-conversions").getByRole("listitem");
    await expect(jobs).toHaveCount(1);
    await expect(jobs.first().getByRole("link")).toHaveAttribute("href", new URL(firstJobUrl).pathname);

    const confirm = dialog.getByRole("button", { name: "Convert to job anyway" });
    await expect(confirm).toHaveClass(/bg-primary/);
    await expect(confirm).not.toHaveClass(/bg-overdue/);
    await confirm.click();
    await page.waitForURL((url) => /\/jobs\/[a-f0-9-]+$/.test(url.pathname) && url.href !== firstJobUrl);
  });
});
