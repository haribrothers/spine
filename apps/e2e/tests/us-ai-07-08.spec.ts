import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { billPdf, startAiStub } from "./ai-stub";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-AI-07 · US-AI-08", () => {
  test("reads the vendor's PDF into the bill page, marks what it filled, and the bill saves as filled in with AI", async ({ page }) => {
    const stub = await startAiStub();
    try {
      await signUpNewOrg(page, { name: "Priya Raman", email: `us-ai-08-${randomUUID()}@example.com`, password: "TestPassword123!" });
      const headers = () => ({ "Idempotency-Key": randomUUID() });
      expect((await page.request.put(`${API_URL}/org/ai`, { headers: headers(), data: { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3-vl:8b", enabled: true } })).ok()).toBe(true);
      expect((await page.request.post(`${API_URL}/contacts`, { headers: headers(), data: { type: "vendor", name: "Apex Building Materials" } })).ok()).toBe(true);
      stub.setReply({
        vendorName: "Apex Building Materials Pvt Ltd",
        billNumber: "ABM-20611",
        billDate: "2026-10-14",
        paymentTerms: "Payment due within 30 days",
        currency: "USD",
        total: "1,250.00",
        lines: [{ item: "Portland cement, 50 kg bags", quantity: 10, unitPrice: "120.00" }],
      });

      await page.goto("/vendor-bills/new");
      await page.getByLabel("Choose the vendor's bill to read").setInputFiles({ name: "ABM-20611.pdf", mimeType: "application/pdf", buffer: billPdf(["Apex Building Materials Pvt Ltd", "Tax invoice ABM-20611"]) });

      const reader = page.getByTestId("bill-ai-reader");
      await expect(reader).toContainText("Read by AI in");
      await expect(reader).toContainText("ABM-20611.pdf");
      await expect(page.getByLabel("Bill number")).toHaveValue("ABM-20611");
      await expect(page.getByText("Matched to your vendor.")).toBeVisible();
      await expect(page.getByText('From the document: “Payment due within 30 days”.')).toBeVisible();
      await expect(page.getByTestId("bill-lines").getByText("Suggested by AI")).toHaveCount(1);
      // The document's total and Spine's differ: $1,250.00 printed, 10 × $120.00 computed.
      await expect(page.getByTestId("bill-total-differs")).toContainText("The document says $1,250.00; the lines add up to $1,200.00.");
      const marks = page.getByTestId("ai-suggested");
      const before = await marks.count();

      // Changing a field makes it mine: its mark goes.
      await page.getByLabel("Bill number").fill("ABM-20611-A");
      await expect(marks).toHaveCount(before - 1);

      await page.getByRole("button", { name: "Save as draft" }).click();
      await expect(page).toHaveURL(/\/vendor-bills\/[0-9a-f-]{36}$/);
      await expect(page.getByTestId("bill-activity-entry").filter({ hasText: "Created as a draft" })).toContainText("filled in with AI");
      await expect(page.getByTestId("attachments")).toContainText("ABM-20611.pdf");
    } finally {
      await stub.close();
    }
  });

  test("when AI doesn't answer, the bill page says so with Try again, keeps what was typed and saves by hand", async ({ page }) => {
    const stub = await startAiStub();
    try {
      await signUpNewOrg(page, { name: "Priya Raman", email: `us-ai-07-${randomUUID()}@example.com`, password: "TestPassword123!" });
      const headers = () => ({ "Idempotency-Key": randomUUID() });
      expect((await page.request.put(`${API_URL}/org/ai`, { headers: headers(), data: { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3-vl:8b", enabled: true } })).ok()).toBe(true);
      expect((await page.request.post(`${API_URL}/contacts`, { headers: headers(), data: { type: "vendor", name: "Ridgeline Equipment Rentals" } })).ok()).toBe(true);
      stub.setDown(true);

      await page.goto("/vendor-bills/new");
      await page.getByLabel("Bill number").fill("RTE-3318");
      await page.getByLabel("Choose the vendor's bill to read").setInputFiles({ name: "RTE-3318.pdf", mimeType: "application/pdf", buffer: billPdf(["Ridgeline Equipment Rentals", "Invoice RTE-3318"]) });
      const notice = page.getByTestId("ai-unavailable");
      await expect(notice).toContainText("AI didn't answer. Fill this in by hand or try again. RTE-3318.pdf is attached either way.");
      await expect(page.getByLabel("Bill number")).toHaveValue("RTE-3318");

      // Back up: Try again fills the empty fields and keeps the typed one.
      stub.setDown(false);
      stub.setReply({ vendorName: "Ridgeline Equipment Rentals", billNumber: "RTE-9999", lines: [] });
      await notice.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByText("Matched to your vendor.")).toBeVisible();
      await expect(page.getByLabel("Bill number")).toHaveValue("RTE-3318");
      await expect(page.getByTestId("ai-replace-offer")).toContainText("Replace my entries (1)");

      // Down again: the bill still saves by hand.
      stub.setDown(true);
      await page.getByTestId("bill-lines").locator("input").first().fill("Excavator hire");
      await page.getByRole("button", { name: "Save as draft" }).click();
      await expect(page).toHaveURL(/\/vendor-bills\/[0-9a-f-]{36}$/);
      await expect(page.getByTestId("attachments")).toContainText("RTE-3318.pdf");
    } finally {
      await stub.close();
    }
  });
});
