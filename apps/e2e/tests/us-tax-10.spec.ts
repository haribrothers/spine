import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-TAX-10", () => {
  test("a rate gets a tax type — GST components for India — and a GST group must be a GST mix", async ({ page }) => {
    await signUpNewOrg(page, { name: "Type Owner", email: `e2e-tax-10-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const put = (path: string, data: unknown) => page.request.put(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data });
    const post = async <T>(path: string, data: unknown) => (await (await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    await put("/org/settings/tax_profile", { value: { country: "IN" } });
    await post("/tax-rates", { name: "CGST 9%", rate: 9, taxType: "cgst" });
    await post("/tax-rates", { name: "IGST 5%", rate: 5, taxType: "igst" });

    await page.goto("/dashboard?settings=tax");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await expect(pane.getByText("9% · CGST")).toBeVisible();

    await pane.getByRole("button", { name: "Add rate" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByLabel("Name").fill("SGST 9%");
    await dialog.getByLabel("Rate (%)").fill("9");
    await expect(dialog.getByText("Reports and GSTR-1 split tax by type: CGST, SGST, UTGST, IGST, cess.")).toBeVisible();
    await dialog.getByRole("combobox", { name: "Tax type" }).click();
    for (const option of ["CGST", "SGST", "UTGST", "IGST", "Cess"]) await expect(page.getByRole("option", { name: option, exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "VAT" })).toHaveCount(0);
    await page.getByRole("option", { name: "SGST", exact: true }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(pane.getByText("9% · SGST")).toBeVisible();

    // A group of CGST 9% and SGST 9% is intra-state; CGST 9% with IGST 5% is refused.
    await pane.getByRole("button", { name: "Add group" }).click();
    await dialog.getByLabel("Name").fill("GST 18%");
    await dialog.getByRole("combobox", { name: "Rates" }).click();
    await page.getByRole("option", { name: "CGST 9% (9%)" }).click();
    await page.getByRole("option", { name: "SGST 9% (9%)" }).click();
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(pane.getByText("CGST (9%) + SGST (9%) · Intra-state")).toBeVisible();

    await pane.getByRole("button", { name: "Add group" }).click();
    await dialog.getByLabel("Name").fill("Wrong");
    await dialog.getByRole("combobox", { name: "Rates" }).click();
    await page.getByRole("option", { name: "CGST 9% (9%)" }).click();
    await page.getByRole("option", { name: "IGST 5% (5%)" }).click();
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("A GST group is CGST + SGST (or UTGST) at the same rate, optionally with cess.")).toBeVisible();
  });

  test("outside India the types are VAT, GST, Sales tax or Other", async ({ page }) => {
    await signUpNewOrg(page, { name: "Vat Owner", email: `e2e-tax-10b-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    await page.goto("/dashboard?settings=tax");
    const pane = page.getByRole("dialog").getByTestId("settings-pane");
    await pane.getByRole("button", { name: "Add rate" }).click();
    const dialog = page.getByRole("alertdialog");
    await dialog.getByRole("combobox", { name: "Tax type" }).click();
    for (const option of ["VAT", "GST", "Sales tax", "Other"]) await expect(page.getByRole("option", { name: option, exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: "CGST" })).toHaveCount(0);
  });
});
