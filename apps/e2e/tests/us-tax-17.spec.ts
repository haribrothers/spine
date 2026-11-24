import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const GSTIN = "29AAACK0000A1ZK";

test.describe("US-TAX-17", () => {
  test("problems are listed with a link to fix each one; Excel downloads; the tax equals the Tax Summary", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-tax-17-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const send = async (method: "put" | "post", path: string, data: unknown) => {
      const res = await page.request[method](`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data });
      expect(res.ok(), await res.text()).toBe(true);
      return res.json();
    };
    await send("put", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } });
    await send("put", "/org/tax/profile", { country: "IN" });
    await send("put", "/org/tax/profile", { registrationNumber: GSTIN, stateCode: "29", legalName: "Kaveri Interiors Private Limited" });
    const gst18 = ((await (await page.request.get(`${API_URL}/tax-groups`)).json()) as { id: string; name: string }[]).find((g) => g.name === "GST 18%")!.id;
    const person = await send("post", "/contacts", { type: "customer", name: "Anita Rao", gstTreatment: "consumer", addresses: [{ type: "billing", line1: "MG Road", stateCode: "29", isPrimary: true }] });
    // Issued today: the ledger posts an invoice on the day it's issued, so the Tax Summary sees it this month.
    const now = new Date();
    const thisMonth = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const draft = await send("post", "/invoices", {
      contactId: person.id,
      currency: "INR",
      lines: [
        { name: "Shoe rack", quantity: 1, unitPriceAmount: "500000", taxGroupId: gst18, hsnSac: "9403" },
        { name: "Fitting", quantity: 1, unitPriceAmount: "100000", taxGroupId: gst18 },
      ],
    });
    const invoice = await send("post", `/invoices/${draft.id}/issue`, {});

    await page.goto("/reports/gstr-1");
    await page.getByRole("combobox", { name: "Period" }).click();
    await page.getByRole("option", { name: thisMonth }).click();
    const cards = page.getByTestId("gstr1-cards");
    await expect(cards).toContainText("Problems");
    await expect(cards).toContainText("fix before uploading");
    await expect(cards).toContainText("equals the Tax Summary");
    const panel = page.getByTestId("gstr1-problems");
    await expect(panel).toContainText("Fix these before you upload");
    await expect(panel).toContainText("1 problem");
    await expect(panel).toContainText(`1 line with no HSN/SAC — ${invoice.number}`);
    await expectNoAxeViolations(page);

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("gstr1-download-xlsx").click()]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`^GSTR1_${GSTIN}_\\d{6}\\.xlsx$`));
    expect(statSync((await download.path())!).size).toBeGreaterThan(1000);

    await panel.getByRole("link", { name: "Open invoice" }).click();
    await expect(page).toHaveURL(new RegExp(`/invoices/${invoice.id}$`));
  });
});
