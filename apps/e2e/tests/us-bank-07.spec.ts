import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const HEADER = "Txn date,Narration,Ref no.,Withdrawal,Deposit,Balance";
const csv = (name: string, lines: string[]) => ({ name, mimeType: "text/csv", buffer: Buffer.from([HEADER, ...lines].join("\n")) });

test.describe("US-BANK-07", () => {
  test("import a CSV statement: map once, skip lines already imported, list rows that couldn't be read", async ({ page }) => {
    await signUpNewOrg(page, { name: "Statement Owner", email: `e2e-bank-07-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const bank = ((await (await page.request.get(`${API_URL}/money-accounts`)).json()) as { id: string; code: string }[]).find((a) => a.code === "1010")!;
    await page.goto(`/banking/${bank.id}`);
    // US-BANK-14: Import statement is under the register's More.
    const openImport = async () => {
      await page.getByRole("button", { name: "More" }).click();
      await page.getByRole("menuitem", { name: "Import statement" }).click();
    };
    await openImport();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Import statement — Bank Account" })).toBeVisible();

    await dialog.getByTestId("statement-file").setInputFiles(
      csv("statement-oct-2026.csv", [
        '01/10/2026,NEFT-MAPLE RIDGE DEV,FT26100248,,"4,542.50","48,230.40"',
        '01/10/2026,CHQ 000214 COASTAL TIMBER,000214,"2,160.00",,"43,687.90"',
        '30/09/2026,ACCOUNT FEES SEP,,18.00,,"45,829.90"',
        "31/09/2026,BAD DATE,,1.00,,",
      ]),
    );
    // First time: the columns are guessed from the headers.
    await expect(dialog.getByText("statement-oct-2026.csv")).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Separate money in and money out columns" })).toBeChecked();
    await expect(dialog.getByRole("combobox", { name: "Date", exact: true })).toHaveText("Txn date");
    await expect(dialog.getByRole("combobox", { name: "Money in" })).toHaveText("Deposit");
    await expect(dialog.getByRole("combobox", { name: "Money out" })).toHaveText("Withdrawal");
    await expect(dialog.getByTestId("statement-preview")).toContainText("NEFT-MAPLE RIDGE DEV");
    await dialog.getByRole("button", { name: "Import 4 lines" }).click();
    await expect(dialog.getByTestId("statement-import-result")).toContainText("Imported 3 lines · skipped 0 already imported · 1 rows couldn't be read");
    await expect(dialog.getByTestId("statement-import-result")).toContainText('Row 5: Couldn\'t read the date "31/09/2026".');
    await dialog.getByRole("button", { name: "Done" }).click();

    // Next time: the saved mapping applies, and lines already there are skipped.
    await openImport();
    await dialog.getByTestId("statement-file").setInputFiles(csv("statement-oct-2026-b.csv", ['01/10/2026,NEFT-MAPLE RIDGE DEV,FT26100248,,"4,542.50",', "03/10/2026,INTEREST CREDIT,,,6.12,"]));
    await expect(dialog.getByRole("combobox", { name: "Description" })).toHaveText("Narration");
    await dialog.getByRole("button", { name: "Import 2 lines" }).click();
    await expect(dialog.getByTestId("statement-import-result")).toContainText("Imported 1 lines · skipped 1 already imported · 0 rows couldn't be read");
    await dialog.getByRole("button", { name: "Done" }).click();

    // Not a CSV, or too many lines.
    await openImport();
    await dialog.getByTestId("statement-file").setInputFiles({ name: "statement.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(dialog).toContainText("Export the statement from your bank as CSV, then import it here.");
    await dialog.getByTestId("statement-file").setInputFiles(csv("huge.csv", Array.from({ length: 5001 }, (_, i) => `01/10/2026,LINE ${i},,1.00,,`)));
    await expect(dialog).toContainText("Split the statement into smaller files (up to 5,000 lines).");
  });
});
