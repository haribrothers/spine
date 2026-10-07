import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-RPT-37", () => {
  test("Tax Summary shows paid by rate, tax types, supply classes and what's been paid to the tax authority", async ({ page, seededOrg }) => {
    void seededOrg;
    await page.goto("/reports/tax-summary");

    const cards = page.getByTestId("tax-summary-cards");
    await expect(cards).toContainText("Paid to the tax authority");
    await expect(cards).toContainText("Still to pay");

    const byType = page.getByTestId("tax-summary-by-type");
    await expect(byType.getByRole("columnheader")).toHaveText(["Tax type", "Collected", "Paid", "Net"]);
    await expect(byType.locator("tfoot")).toContainText("Total");

    const paid = page.getByTestId("tax-summary-paid");
    await expect(paid.getByRole("columnheader")).toHaveText(["Paid by rate", "Taxable amount", "Tax"]);
    await expect(paid.locator("tfoot")).toContainText("Total paid");

    const classes = page.getByTestId("tax-summary-supply-class");
    await expect(classes.getByRole("columnheader")).toHaveText(["Supply class", "Sales", "Purchases"]);
    for (const label of ["Zero-rated", "Exempt", "Non-taxable"]) await expect(classes).toContainText(label);
  });

  test("a GST business sees CGST, SGST, IGST and cess", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-rpt-37-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const put = (path: string, data: unknown) => page.request.put(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data });
    await put("/org/settings/currency", { value: { code: "INR", locale: "en-IN" } });
    await put("/org/tax/profile", { country: "IN" });
    await put("/org/tax/profile", { registrationNumber: "29AAACK0000A1ZK", stateCode: "29", legalName: "Kaveri Interiors Private Limited" });
    await page.goto("/reports/tax-summary");
    const rows = page.getByTestId("tax-summary-by-type").locator("tbody tr");
    await expect(rows.locator("td:first-child")).toHaveText(["CGST", "SGST", "IGST", "Cess"]);
  });
});
