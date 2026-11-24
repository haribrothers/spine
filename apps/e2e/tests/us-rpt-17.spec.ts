import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-RPT-17", () => {
  test("import opening invoices (creating unmatched customers), see them as Opening balance invoices, add customer credit", async ({ page }) => {
    await signUpNewOrg(page, { name: "Opening Docs Owner", email: `e2e-rpt-17-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const send = async <T>(method: "post" | "put", path: string, data?: unknown): Promise<T> => {
      const res = await page.request[method](`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    await send("put", "/opening-balances", { cutoverDate: "2026-07-01", lines: [] });
    const maple = await send<{ id: string }>("post", "/contacts", { type: "customer", name: "Maple Ridge Developments" });
    await send("post", "/jobs", { contactId: maple.id, name: "Hotel lobby refurb", currency: "USD" });

    await page.goto("/opening-balances");
    await page.getByRole("tab", { name: "Customer invoices" }).click();
    await expect(page.getByText("No opening invoices yet.")).toBeVisible();
    await page.getByRole("button", { name: "Import from CSV" }).click();
    const dialog = page.getByRole("dialog");
    const csv = [
      "Customer,Invoice no.,Invoice date,Due date,Amount due,Retention,Job",
      "Maple Ridge Developments,RB-2291,28/05/2026,27/06/2026,8750.00,,",
      "Sunstone Retail Fitouts,RB-2310,20/06/2026,20/07/2026,3450.00,1500.00,Hotel lobby refurb",
    ].join("\n");
    await dialog.getByTestId("opening-invoices-file").setInputFiles({ name: "opening-invoices.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(dialog.getByRole("combobox", { name: "Customer name" })).toHaveText("Customer");
    await expect(dialog.getByRole("combobox", { name: "Retention held" })).toHaveText("Retention");
    await dialog.getByRole("button", { name: "Import 2 invoices" }).click();
    await expect(dialog.getByTestId("opening-import-unmatched")).toContainText("1 customer name didn't match anyone in Spine: Sunstone Retail Fitouts.");
    await dialog.getByRole("button", { name: "Create these customers" }).click();
    await expect(dialog.getByTestId("opening-import-result")).toContainText("Imported 2 invoices · 0 rows couldn't be imported");
    await dialog.getByRole("button", { name: "Done" }).click();

    const table = page.getByTestId("opening-invoices");
    await expect(table).toContainText("RB-2291");
    await expect(table.getByRole("row").filter({ hasText: "RB-2310" })).toContainText("$1,500.00");
    await expect(table.getByRole("row").filter({ hasText: "RB-2310" })).toContainText("Hotel lobby refurb");

    // Using a number already taken.
    await table.getByRole("button", { name: "Edit RB-2310" }).click();
    await dialog.getByRole("textbox", { name: "Invoice number" }).fill("RB-2291");
    await dialog.getByRole("button", { name: "Save invoice" }).click();
    await expect(dialog).toContainText("Invoice RB-2291 already exists. Use the number from your old system exactly once.");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // The Account balances tab shows them on receivables and retention.
    await page.getByRole("tab", { name: "Account balances" }).click();
    await expect(page.getByTestId("opening-row").filter({ hasText: "Accounts Receivable" })).toContainText("From opening invoices · $12,200.00");

    // Customer credit.
    await page.getByRole("tab", { name: "Customer credit" }).click();
    await page.getByRole("button", { name: "Add credit" }).click();
    await dialog.getByRole("combobox", { name: "Customer" }).click();
    await page.getByRole("option", { name: "Maple Ridge Developments" }).click();
    await dialog.getByRole("textbox", { name: "Amount" }).fill("600");
    await dialog.getByRole("button", { name: "Add credit" }).click();
    await expect(page.getByTestId("opening-credits")).toContainText("$600.00");

    // On Invoices they're "Opening balance" invoices without a PDF.
    await page.goto("/invoices");
    await expect(page.getByRole("row").filter({ hasText: "RB-2291" })).toContainText("Opening balance");
    await page.getByRole("row").filter({ hasText: "RB-2291" }).getByRole("link", { name: "RB-2291" }).click();
    await expect(page.getByText("Brought in from your old system, so it has no lines.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Download PDF" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Record payment" })).toBeVisible();
  });
});
