import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { api } from "./quote-seed";

test.describe("US-ONB-29", () => {
  test("the demo's credit notes show what came off invoices, credit to use, applied and refunded", async ({ page }) => {
    test.setTimeout(120_000);
    await signUpNewOrg(page, { name: "Demo Owner", email: `e2e-onb-29-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await api(page, "POST", "/demo-data/seed", { country: "GB", industry: "it_services" });

    await page.goto("/credit-notes");
    const where = page.getByTestId("where-it-went");
    await expect(where).toHaveCount(3);
    await expect(page.getByTestId("credit-note-stats").getByRole("button", { name: /^Show credit notes with credit left, [1-9]/ })).toBeVisible();
    const texts = (await where.allTextContents()).join(" | ");
    expect(texts).toMatch(/Off /);
    expect(texts).toMatch(/Applied /);
    expect(texts).toMatch(/Refunded /);
  });
});
