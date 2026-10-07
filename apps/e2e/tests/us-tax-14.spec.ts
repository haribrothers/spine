import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-TAX-14", () => {
  test("items and lines carry an HSN/SAC code; issuing to a registered business warns about lines without one", async ({ page }) => {
    await signUpNewOrg(page, { name: "Anita", email: `e2e-tax-14-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const send = async <T>(method: "post" | "put", path: string, data: unknown) =>
      (await (await page.request[method](`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data })).json()) as T;
    await send("put", "/org/tax/profile", { country: "IN" });
    await send("put", "/org/tax/profile", { registrationNumber: "29AAACK0000A1ZK", stateCode: "29", legalName: "Kaveri Interiors" });
    await send("post", "/contacts", { type: "customer", isCompany: true, name: "Lakeview Homes LLP", gstTreatment: "registered", taxId: "29AAACK0000A1ZK" });

    // Catalogue: the HSN/SAC code takes 4, 6 or 8 digits.
    await page.goto("/catalog");
    await page.getByRole("button", { name: "Add item" }).first().click();
    const drawer = page.getByRole("dialog");
    await drawer.getByLabel("HSN/SAC code").fill("94031");
    await expect(drawer.getByText("Enter 4, 6 or 8 digits.")).toBeVisible();
    await drawer.getByLabel("HSN/SAC code").fill("9403");
    await expect(drawer.getByText("Enter 4, 6 or 8 digits.")).toHaveCount(0);
    await expect(drawer.getByText("4, 6 or 8 digits. Copied to each line; change it there if needed.")).toBeVisible();
    await page.keyboard.press("Escape");
    await send("post", "/catalog-items", { name: "Modular kitchen", unit: "set", defaultPriceAmount: "100000", defaultPriceCurrency: "INR", hsnSac: "9403" });

    // A line copies the item's code and can change it; a one-off line has none.
    await page.goto("/invoices/new");
    await page.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
    await page.getByPlaceholder("Search…").fill("Lakeview");
    await page.getByRole("option", { name: /Lakeview Homes LLP/ }).click();
    const item = page.getByRole("combobox", { name: "Item" }).first();
    await item.click();
    await item.fill("Modular");
    await page.getByRole("listbox", { name: "Catalogue matches" }).getByRole("option", { name: /^Modular kitchen/ }).click();
    const codes = page.getByLabel("HSN/SAC");
    await expect(codes.first()).toHaveValue("9403");
    await codes.first().fill("940310");
    await page.getByRole("button", { name: "Add item" }).click();
    await page.getByRole("combobox", { name: "Item" }).nth(1).fill("Site visit");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await page.waitForURL(/\/invoices\/[0-9a-f-]{36}$/);
    const invoiceId = page.url().split("/").pop()!;
    const saved = (await (await page.request.get(`${API_URL}/invoices/${invoiceId}`)).json()) as { lines: { name: string; hsnSac: string | null }[] };
    expect(saved.lines.map((l) => l.hsnSac)).toEqual(["940310", null]);

    // Issuing to a registered business warns about the line without a code, and can go ahead.
    await page.getByRole("button", { name: "Issue Invoice" }).click();
    const warning = page.getByRole("alertdialog");
    await expect(warning.getByText("1 line has no HSN/SAC code. GSTR-1 needs them.", { exact: false })).toBeVisible();
    await warning.getByRole("button", { name: "Issue anyway" }).click();
    await expect(page.getByText("Invoice issued")).toBeVisible();
  });
});
