import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-OPS-24", () => {
  test("amounts read '$1,234.50' and follow the organisation's locale", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/invoices");
    const firstTotal = page.locator("tbody tr").first().locator("td").filter({ hasText: /\$/ }).first();
    await expect(firstTotal).toHaveText(/^\s*\$\d{1,3}(,\d{3})*\.\d{2}\s*$/);
    await expect(page.locator("tbody")).not.toContainText(" USD");

    const saved = await page.request.put(`${API_URL}/org/settings/currency`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { value: { code: "USD", locale: "de-DE" } },
    });
    expect(saved.ok()).toBe(true);
    await page.reload();
    await expect(page.locator("tbody tr").first().locator("td").filter({ hasText: /\$/ }).first()).toHaveText(/^\s*\d{1,3}(\.\d{3})*,\d{2}\s\$\s*$/);

    await page.request.put(`${API_URL}/org/settings/currency`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { value: { code: "USD", locale: "en-US" } },
    });
  });
});
