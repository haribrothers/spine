import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { expectNoAxeViolations } from "./axe";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n", "latin1");
// A 1×1 PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test.describe("US-OPS-33", () => {
  test("drop the vendor's PDF on a new bill, add a photo later, and see the paperclip on the list", async ({ page }) => {
    await signUpNewOrg(page, { name: "Files Owner", email: `e2e-ops-33-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
    const res = await page.request.post(`${API_URL}/contacts`, { data: { type: "vendor", name: "Coastal Timber Supply" }, headers: { "Idempotency-Key": randomUUID() } });
    expect(res.ok()).toBe(true);

    await page.goto("/vendor-bills/new");
    await page.getByRole("combobox").filter({ hasText: "Select a vendor…" }).click();
    await page.getByRole("option", { name: "Coastal Timber Supply" }).click();
    await page.getByPlaceholder("e.g. INV-1042").fill("88213");
    await page.getByRole("combobox", { name: "Item" }).first().fill("Treated pine 90×45");
    const attachments = page.getByTestId("attachments");
    await attachments.getByLabel("Choose files to attach").setInputFiles({ name: "coastal-timber-88213.pdf", mimeType: "application/pdf", buffer: PDF });
    await expect(attachments).toContainText("coastal-timber-88213.pdf");
    await expect(attachments).toContainText("added when you save");
    await page.getByRole("button", { name: "Save as draft" }).click();
    await page.waitForURL(/\/vendor-bills\/[0-9a-f-]{36}$/);

    await expect(attachments).toContainText("coastal-timber-88213.pdf");
    await expect(attachments).toContainText("added by Files Owner");
    await expect(attachments.getByRole("link", { name: "Download coastal-timber-88213.pdf" })).toHaveAttribute("href", /\/files\/[0-9a-f-]{36}\?download=1$/);
    await expect(attachments.getByText("PDF", { exact: true })).toBeVisible();

    await attachments.getByLabel("Choose files to attach").setInputFiles({ name: "delivery-docket-site.png", mimeType: "image/png", buffer: PNG });
    await expect(attachments.getByRole("link", { name: "delivery-docket-site.png", exact: true })).toBeVisible();
    await expect(attachments.locator("img")).toHaveCount(1);

    // Another type is refused with the upload message.
    await attachments.getByLabel("Choose files to attach").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(attachments).toContainText("This file type isn't supported. Upload a photo or a PDF.");
    await expectNoAxeViolations(page);

    await page.goto("/vendor-bills");
    await expect(page.getByLabel("2 attachments")).toBeVisible();
  });
});
