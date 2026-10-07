import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-RPT-33", () => {
  test("Export › PDF downloads the report as a PDF named after the report and range", async ({ page }) => {
    await signUpNewOrg(page, { name: "Pdf Owner", email: `e2e-rpt-33-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    for (const [path, name] of [
      ["/reports/profit-and-loss", /^profit-and-loss-\d{4}-01-01-\d{4}-\d{2}-\d{2}\.pdf$/],
      ["/reports/trial-balance", /^trial-balance-\d{4}-\d{2}-\d{2}\.pdf$/],
      ["/reports/cash-flow", /^cash-flow-\d{4}-\d{2}-01-\d{4}-\d{2}-\d{2}\.pdf$/],
    ] as const) {
      await page.goto(path);
      await page.getByRole("button", { name: "Export", exact: true }).click();
      const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "PDF" }).click()]);
      expect(file.suggestedFilename()).toMatch(name);
      expect(readFileSync((await file.path())!).subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});
