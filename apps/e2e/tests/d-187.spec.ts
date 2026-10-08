import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("D-187", () => {
  test("issuing an invoice offers the customer's credit first, and applies it", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `d-187-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const send = async (method: "put" | "post", path: string, data: unknown) => {
      const res = await page.request[method](`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data });
      expect(res.ok(), await res.text()).toBe(true);
      return res.json();
    };
    await send("put", "/org/settings/currency", { value: { code: "INR", locale: "en-IN" } });
    const contact = await send("post", "/contacts", { type: "customer", name: "Lakeview Homes" });
    await send("post", "/payments", { contactId: contact.id, date: "2026-09-01", method: "upi", currency: "INR", amount: "50000" });
    const draft = await send("post", "/invoices", { contactId: contact.id, currency: "INR", lines: [{ name: "Kitchen", quantity: 1, unitPriceAmount: "118000" }] });

    await page.goto(`/invoices/${draft.id}`);
    await page.getByRole("button", { name: "Issue Invoice" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading", { name: "Apply this customer's credit?" })).toBeVisible();
    await expect(dialog).toContainText("Lakeview Homes has ₹500.00 of credit from payments and credit notes.");
    await expect(dialog.getByRole("button", { name: "Issue without credit" })).toBeVisible();
    await expectNoAxeViolations(page);
    await dialog.getByRole("button", { name: "Apply credit and issue" }).click();
    await expect(page.getByText("₹500.00 of credit was applied.", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("₹680.00").first()).toBeVisible();
  });
});
