import { readFileSync } from "node:fs";
import { test, expect } from "./fixtures";

test.describe("US-SET-12", () => {
  test("Export CSV downloads the filtered audit entries", async ({ page, seededOrg: _ }) => {
    await page.goto("/team/audit-log");
    await expect(page.getByTestId("audit-table").locator("tbody tr").first()).toBeVisible();
    await page.getByRole("combobox", { name: "Record type" }).click();
    await page.getByRole("option", { name: "Invoice", exact: true }).click();
    await expect(page.getByTestId("audit-export")).toHaveAttribute("href", /\/org\/audit-log\.csv\?.*entityType=invoice/);

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("audit-export").click()]);
    expect(download.suggestedFilename()).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = readFileSync((await download.path())!, "utf8").split("\r\n").filter(Boolean);
    expect(lines[0]).toBe("timestamp,actor_name,actor_email,action,record_type,record_id,record,changes");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(1)) expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z,.*,Invoice,[0-9a-f-]{36},/);
  });
});
