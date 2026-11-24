import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-RPT-38", () => {
  test("Reports › Export to Tally shows what the file holds and downloads the ZIP", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-rpt-38-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const send = async (path: string, data: unknown) => {
      const res = await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data });
      expect(res.ok(), await res.text()).toBe(true);
      return res.json();
    };
    const contact = await send("/contacts", { type: "customer", name: "Lakeview Homes" });
    const draft = await send("/invoices", { contactId: contact.id, currency: "USD", lines: [{ name: "Kitchen", quantity: 1, unitPriceAmount: "100000" }] });
    await send(`/invoices/${draft.id}/issue`, {});

    await page.goto("/reports");
    await page.getByTestId("report-group").filter({ hasText: "Accountant" }).getByRole("link", { name: "Export to Tally" }).click();
    await expect(page).toHaveURL(/\/reports\/tally$/);
    await expect(page.getByRole("heading", { name: "Export to Tally" })).toBeVisible();
    await expect(page.getByText("A file your accountant imports into TallyPrime or Tally.ERP 9.", { exact: false })).toBeVisible();

    const cards = page.getByTestId("tally-cards");
    await expect(cards).toContainText("Ledgers");
    await expect(cards).toContainText("Vouchers");
    await expect(cards).toContainText("Accounts on default groups");
    await expect(cards).toContainText("review the mapping");
    const table = page.getByTestId("tally-vouchers");
    await expect(table.getByRole("columnheader")).toHaveText(["Spine document", "Tally voucher type", "Count"]);
    await expect(table.getByRole("row", { name: /Invoices Sales 1/ })).toBeVisible();
    for (const type of ["Purchase", "Receipt", "Payment", "Contra", "Journal", "Credit Note", "Debit Note"]) await expect(table).toContainText(type);
    await expect(page.getByTestId("tally-howto")).toContainText("Gateway of Tally › Import › Masters, then Transactions");
    await expectNoAxeViolations(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expect(table.getByRole("row", { name: /Invoices Sales 1/ })).toBeVisible();
    await expectNoAxeViolations(page);
    await page.emulateMedia({ colorScheme: "light" });

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("tally-export").click()]);
    expect(download.suggestedFilename()).toMatch(/^tally-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.zip$/);
    // A ZIP starts with "PK".
    expect(readFileSync((await download.path())!).subarray(0, 2).toString()).toBe("PK");

    await page.getByRole("link", { name: "Account mapping" }).click();
    await expect(page).toHaveURL(/\/reports\/tally\/mapping$/);
    await expect(page.getByRole("heading", { name: "Account mapping" })).toBeVisible();
  });
});
