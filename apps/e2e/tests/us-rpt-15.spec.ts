import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The table shows 10 jobs a page (its first page-size option); earlier specs add jobs to the shared organisation. */
const PAGE = 10;

test.describe("US-RPT-15", () => {
  test("Job Profitability shows the contract, billed and cost chart above the table, follows the status filter, and the table gains billed and budget columns", async ({ page, seededOrg: _ }) => {
    const all = ((await (await page.request.get(`${API_URL}/reports/job-profitability?status=all`)).json()) as { jobs: { name: string; status: string }[] }).jobs;
    const open = all.filter((j) => j.status === "active" || j.status === "on_hold");

    await page.goto("/reports/job-profitability");
    await expect(page.getByRole("heading", { name: "Contract, billed and cost by job" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Contract, billed and cost by job" })).toBeVisible();
    for (const legend of ["Contract value", "Billed to date", "Cost", "Cost budget"]) await expect(page.getByText(legend, { exact: true }).first()).toBeVisible();
    for (const header of ["Contract value", "Billed to date", "Billed %", "Budget used", "Revenue", "Cost", "Margin", "Margin %"]) {
      await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
    }
    // Heading row, one per job on the first page, and the totals row.
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(Math.min(open.length, PAGE) + 2);

    await page.getByRole("combobox", { name: "Jobs" }).click();
    await page.getByRole("option", { name: "All" }).click();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(Math.min(all.length, PAGE) + 2);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: "CSV" })).toHaveAttribute("href", /status=all/);
    await page.keyboard.press("Escape");
  });
});
