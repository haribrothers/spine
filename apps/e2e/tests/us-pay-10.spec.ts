import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";

async function download(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()]);
  return readFileSync((await file.path())!, "utf8").split("\r\n");
}

test.describe("US-PAY-10", () => {
  test("Receivables › Export CSV downloads what's on screen, search included", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/receivables?view=invoices");
    const rows = page.locator("tbody tr");
    // Wait for the invoices themselves, not the loading skeleton's rows.
    await expect(rows.first()).toContainText(/INV-/);
    const onScreen = await rows.count();

    const lines = await download(page);
    expect(lines[0]).toBe("Invoice #,Contact,Currency,Due date,Total,Balance due,Days overdue,Bucket");
    expect(lines.length - 1).toBeGreaterThanOrEqual(onScreen);
    expect(lines[1]).toMatch(/,[A-Z]{3},.*,\d+\.\d{2},\d+\.\d{2},/);

    const firstNumber = lines[1]!.split(",")[0]!;
    await page.getByRole("searchbox", { name: "Search receivables" }).fill(firstNumber);
    await expect(rows).toHaveCount(1);
    const filtered = await download(page);
    expect(filtered).toHaveLength(2);
    expect(filtered[1]!.startsWith(`${firstNumber},`)).toBe(true);
  });
});
