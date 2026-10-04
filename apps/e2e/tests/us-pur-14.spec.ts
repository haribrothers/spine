import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

test.describe("US-PUR-14", () => {
  test("Payables › Export CSV with no open bills downloads only the header row", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-pur-14-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await page.goto("/payables");
    const [file] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()]);
    expect(file.suggestedFilename()).toMatch(/^payables-.*\.csv$/);
    expect(readFileSync((await file.path())!, "utf8")).toBe("Bill #,Contact,Currency,Due date,Total,Balance due,Days overdue,Bucket");
  });
});
