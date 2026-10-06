import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-RPT-18", () => {
  test("import opening bills (creating unmatched vendors), add an opening vendor credit, see them in Bills and on the grid", async ({ page }) => {
    await signUpNewOrg(page, { name: "Opening Bills Owner", email: `e2e-rpt-18-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const send = async <T>(method: "post" | "put", path: string, data?: unknown): Promise<T> => {
      const res = await page.request[method](`${API_URL}${path}`, { data, headers: { "Idempotency-Key": randomUUID() } });
      expect(res.ok(), await res.text()).toBe(true);
      return (await res.json()) as T;
    };
    await send("put", "/opening-balances", { cutoverDate: "2026-07-01", lines: [] });
    await send("post", "/contacts", { type: "vendor", name: "Coastal Timber Supply" });

    await page.goto("/opening-balances");
    await page.getByRole("tab", { name: "Vendor bills" }).click();
    await page.getByRole("button", { name: "Import from CSV" }).click();
    const dialog = page.getByRole("dialog");
    const csv = ["Vendor,Bill no.,Bill date,Due date,Amount", "Coastal Timber Supply,88213,10/06/2026,10/07/2026,6915.40", "Harbour Plumbing,HP-51,20/06/2026,20/07/2026,450.00"].join("\n");
    await dialog.getByTestId("opening-bills-file").setInputFiles({ name: "opening-bills.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await dialog.getByRole("button", { name: "Import 2 bills" }).click();
    await expect(dialog.getByTestId("opening-import-unmatched")).toContainText("1 vendor name didn't match anyone in Spine: Harbour Plumbing.");
    await dialog.getByRole("button", { name: "Create these vendors" }).click();
    await expect(dialog.getByTestId("opening-import-result")).toContainText("Imported 2 bills · 0 rows couldn't be imported");
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(page.getByTestId("opening-bills")).toContainText("88213");
    await expect(page.getByTestId("opening-bills")).toContainText("$6,915.40");

    await page.getByRole("tab", { name: "Vendor credits" }).click();
    await page.getByRole("button", { name: "Add credit" }).click();
    await dialog.getByRole("combobox", { name: "Vendor" }).click();
    await page.getByRole("option", { name: "Coastal Timber Supply" }).click();
    await dialog.getByRole("textbox", { name: "Amount" }).fill("400");
    await dialog.getByRole("textbox", { name: "Vendor's credit note number" }).fill("CN-4471");
    await dialog.getByRole("button", { name: "Add credit" }).click();
    await expect(page.getByTestId("opening-vendor-credits")).toContainText("VCR-0001 · their CN-4471");

    await page.getByRole("tab", { name: "Account balances" }).click();
    await expect(page.getByTestId("opening-row").filter({ hasText: "Accounts Payable" })).toContainText("From opening bills · $6,965.40");

    await page.goto("/vendor-bills");
    await expect(page.getByRole("row").filter({ hasText: "88213" })).toContainText("Opening balance");
    await page.getByRole("link", { name: "88213" }).click();
    await expect(page.getByText("Brought in from your old system, so it has no lines.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Void", exact: true })).toHaveCount(0);
  });
});
