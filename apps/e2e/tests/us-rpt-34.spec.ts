import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("US-RPT-34", () => {
  test("Print hides the app chrome, prints every row with headings that repeat, and carries the title, range and business", async ({ page }) => {
    await signUpNewOrg(page, { name: "Print Owner", email: `e2e-rpt-34-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.request.put(`${API_URL}/org/settings/business_profile`, { headers: { "Idempotency-Key": randomUUID() }, data: { value: { name: "Riverstone Builders" } } });
    const customer = (await (
      await page.request.post(`${API_URL}/contacts`, { headers: { "Idempotency-Key": randomUUID() }, data: { type: "customer", name: "Maple Ridge Developments" } })
    ).json()) as { id: string };
    for (let i = 1; i <= 12; i++) {
      await page.request.post(`${API_URL}/payments`, { headers: { "Idempotency-Key": randomUUID() }, data: { contactId: customer.id, date: today(), method: "cash", currency: "USD", amount: String(1000 * i) } });
    }

    await page.goto("/reports/payments-received");
    const table = page.getByTestId("register-table");
    await expect(table.getByRole("row")).toHaveCount(12);
    // The browser's print dialog can't be driven; count the calls instead.
    await page.evaluate("window.printed = 0; window.print = () => { window.printed += 1; };");

    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page.getByRole("menuitem", { name: "Print" }).click();
    await expect.poll(() => page.evaluate("window.printed")).toBe(1);
    // Every row, not just the first page (plus the heading and totals rows).
    await expect(table.getByRole("row")).toHaveCount(14);

    await page.emulateMedia({ media: "print" });
    await expect(page.locator("aside")).toBeHidden();
    await expect(page.getByRole("button", { name: "Export", exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Payments received", level: 1 })).toBeVisible();
    await expect(page.getByTestId("print-header")).toBeVisible();
    await expect(page.getByTestId("print-header")).toContainText(/Riverstone Builders · .+\d{4}/);
    const style = (selector: string, property: string) => page.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)}))[${JSON.stringify(property)}]`);
    expect(await style('[data-testid="register-table"] thead', "display")).toBe("table-header-group");
    expect(await style('[data-testid="register-table"] tbody tr', "breakInside")).toBe("avoid");
    expect(await style("main", "overflowY")).toBe("visible");

    await page.emulateMedia({ media: "screen" });
    await expect(page.getByTestId("print-header")).toBeHidden();
    await page.evaluate('window.dispatchEvent(new Event("afterprint"))');
    await expect(table.getByRole("row")).toHaveCount(12);
  });
});
