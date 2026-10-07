import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-CAT-09", () => {
  test("Import maps the columns, previews flagged rows, imports the good ones and offers the failed rows", async ({ page }) => {
    await signUpNewOrg(page, { name: "Catalogue Owner", email: `e2e-cat-09-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.request.post(`${API_URL}/catalog-items`, { headers: { "Idempotency-Key": randomUUID() }, data: { name: "Site visit", unit: "hour", defaultPriceAmount: "9500", defaultPriceCurrency: "USD" } });

    await page.goto("/catalog");
    await page.getByRole("button", { name: "Import" }).click();
    const dialog = page.getByRole("dialog", { name: "Import catalogue items" });
    const csv = ["Item Name,Description,Unit,Price,Tax,Income Account", "Kitchen fit-out,Full kitchen,job,\"$12,500.00\",,4100", "Site visit,,hour,95,,", "Tiles,,box,40,VAT 20%,"].join("\n");
    await dialog.getByLabel("Choose a CSV file").setInputFiles({ name: "items.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

    await expect(dialog).toContainText("items.csv · 3 rows");
    await expect(dialog.getByRole("combobox", { name: "Name (required)" })).toHaveText("Item Name");
    await expect(dialog.getByRole("combobox", { name: "Price" })).toHaveText("Price");
    await expect(dialog.getByRole("combobox", { name: "Income account" })).toHaveText("Income Account");
    await dialog.getByRole("button", { name: "Preview" }).click();

    await expect(dialog.getByTestId("import-preview-summary")).toHaveText("1 ready to import · 1 duplicate to skip · 1 row with problems");
    const preview = dialog.getByTestId("import-preview");
    await expect(preview.getByRole("row", { name: /Tiles/ })).toContainText("Unknown tax VAT 20%");
    await expect(preview.getByRole("row", { name: /Site visit/ })).toContainText("Duplicate — skipped");

    await dialog.getByRole("button", { name: "Import 1 item" }).click();
    await expect(dialog.getByTestId("import-summary")).toHaveText("Imported 1 item · skipped 1 duplicate · 1 row failed");
    await expect(dialog).toContainText("Skipped as duplicates: Site visit");
    const [file] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download failed rows" }).click()]);
    expect(file.suggestedFilename()).toBe("items-failed-rows.csv");
    const failed = readFileSync((await file.path())!, "utf8");
    expect(failed).toContain("Problem");
    expect(failed).toContain("Tiles");
    expect(failed).toContain("Unknown tax VAT 20%");

    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("table")).toContainText("Kitchen fit-out");
    await expect(page.getByRole("table")).toContainText("$12,500.00");
  });
});
