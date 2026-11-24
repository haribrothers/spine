import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const GSTIN = "29AAACK0000A1ZK";

/** The month just ended, as the page picks it by default. */
function lastMonth(): { value: string; date: string; label: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 12);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { value, date: `${value}-12`, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) };
}

async function gstBusiness(page: Page) {
  await signUpNewOrg(page, { name: "Owner", email: `us-tax-16-${randomUUID()}@example.com`, password: "TestPassword123!" });
  const send = async (method: "put" | "post", path: string, data: unknown) => {
    const res = await page.request[method](`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data });
    expect(res.ok(), await res.text()).toBe(true);
    return res.json();
  };
  await send("put", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } });
  await send("put", "/org/tax/profile", { country: "IN" });
  await send("put", "/org/tax/profile", { registrationNumber: GSTIN, stateCode: "29", legalName: "Kaveri Interiors Private Limited" });
  const groups = (await (await page.request.get(`${API_URL}/tax-groups`)).json()) as { id: string; name: string }[];
  const gst18 = groups.find((g) => g.name === "GST 18%")!.id;
  const contact = await send("post", "/contacts", {
    type: "customer",
    isCompany: true,
    name: "Lakeview Homes LLP",
    gstTreatment: "registered",
    taxId: "29AABFL0000B1ZA",
    addresses: [{ type: "billing", line1: "8 Indiranagar", stateCode: "29", isPrimary: true }],
  });
  const draft = await send("post", "/invoices", {
    contactId: contact.id,
    currency: "INR",
    issueDate: lastMonth().date,
    lines: [{ name: "Modular kitchen", quantity: 1, unitPriceAmount: "18000000", taxGroupId: gst18, hsnSac: "9403" }],
  });
  return send("post", `/invoices/${draft.id}/issue`, {});
}

test.describe("US-TAX-16", () => {
  test("a GST business opens GSTR-1 from Reports, sees each table and downloads the JSON", async ({ page }) => {
    const invoice = await gstBusiness(page);
    await page.goto("/reports");
    await page.getByTestId("report-group").filter({ hasText: "Tax" }).getByRole("link", { name: "GSTR-1" }).click();
    await expect(page).toHaveURL(/\/reports\/gstr-1$/);
    await expect(page.getByRole("heading", { name: "GSTR-1" })).toBeVisible();
    await expect(page.getByText(`${lastMonth().label} · GSTIN ${GSTIN}`)).toBeVisible();

    await expect(page.getByTestId("gstr1-cards")).toContainText(invoice.number);
    const tables = page.getByTestId("gstr1-tables");
    await expect(tables.getByRole("columnheader")).toHaveText(["Table", "Documents", "Taxable value", "Tax"]);
    await expect(page.getByTestId("gstr1-row-b2b")).toContainText("B2B — registered customers");
    await expect(page.getByTestId("gstr1-row-b2b")).toContainText("₹1,80,000.00");
    await expect(page.getByTestId("gstr1-row-b2b")).toContainText("₹32,400.00");
    for (const name of ["B2CL — large unregistered inter-state", "B2CS — other unregistered", "CDNR — credit notes, registered", "Exports", "Nil, exempt and non-GST", "HSN summary", "Documents issued"]) {
      await expect(tables).toContainText(name);
    }
    await expect(page.getByTestId("gstr1-row-hsn")).toContainText("1 code");
    await expect(page.getByTestId("gstr1-footer")).toHaveText("Spine prepares this file; it doesn't file your return. Check it, then upload it on the GST portal.");
    await expectNoAxeViolations(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await expect(page.getByTestId("gstr1-row-b2b")).toContainText("₹32,400.00");
    await expectNoAxeViolations(page);
    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await expect(page.getByTestId("gstr1-row-b2b")).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("gstr1-download-json").click()]);
    const fp = `${lastMonth().value.slice(5, 7)}${lastMonth().value.slice(0, 4)}`;
    expect(download.suggestedFilename()).toBe(`GSTR1_${GSTIN}_${fp}.json`);
    const file = JSON.parse(readFileSync((await download.path())!, "utf8")) as { gstin: string; fp: string; version: string; b2b: { inv: { inum: string }[] }[] };
    expect(file).toMatchObject({ gstin: GSTIN, fp });
    expect(file.version).toMatch(/^GST\d/);
    expect(file.b2b[0]!.inv[0]!.inum).toBe(invoice.number);

    // Quarterly filing switches the period list to quarters.
    await page.getByRole("combobox", { name: "Filing" }).click();
    await page.getByRole("option", { name: "Quarterly" }).click();
    await expect(page.getByRole("combobox", { name: "Period" })).toHaveText(/^[A-Z][a-z]{2} – [A-Z][a-z]{2} \d{4}$/);
  });

  test("a business outside India doesn't see GSTR-1", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-tax-16-us-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await page.goto("/reports");
    await expect(page.getByTestId("report-group").filter({ hasText: "Tax" })).toContainText("Tax Summary");
    await expect(page.getByRole("link", { name: "GSTR-1" })).toHaveCount(0);
  });
});
