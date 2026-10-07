import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

async function openPane(page: Page) {
  await page.getByRole("button", { name: /Owner/ }).last().click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Payment instructions" }).click();
  return dialog;
}

test.describe("US-INV-25", () => {
  test("an INR business sets its UPI ID; a bad one is refused and the QR switch turns on", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-inv-25-${randomUUID()}@example.com`, password: "TestPassword123!" });
    await page.request.put(`${API_URL}/org/settings/currency`, { headers: { "Idempotency-Key": randomUUID() }, data: { value: { code: "INR", locale: "en-IN" } } });
    await page.reload();
    let dialog = await openPane(page);
    await expect(dialog.getByRole("heading", { name: "UPI" })).toBeVisible();
    const upi = dialog.getByLabel("UPI ID");
    await expect(upi).toHaveAttribute("placeholder", "e.g. riverstone@okhdfc");
    await expect(dialog).toContainText("Each issued invoice gets a QR code for its balance due. Payments still need recording — or find them when you reconcile.");
    await expect(dialog).toContainText("Issued invoices keep the instructions and QR code they were issued with");

    await upi.fill("river stone@okhdfc");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Enter a UPI ID like name@bank.")).toBeVisible();

    await upi.fill("riverstone@okhdfc");
    const qr = dialog.getByRole("switch", { name: "Show a UPI QR code on invoices" });
    await expect(qr).toBeChecked();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Your changes have been saved.").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await page.reload();
    dialog = await openPane(page);
    await expect(dialog.getByLabel("UPI ID")).toHaveValue("riverstone@okhdfc");
    await expect(dialog.getByRole("switch", { name: "Show a UPI QR code on invoices" })).toBeChecked();
  });

  test("other currencies don't show the UPI fields", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-inv-25-usd-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const dialog = await openPane(page);
    await expect(dialog.getByLabel("How customers can pay")).toBeVisible();
    await expect(dialog.getByLabel("UPI ID")).toHaveCount(0);
    await expect(dialog.getByText("Show a UPI QR code on invoices")).toHaveCount(0);
  });
});
