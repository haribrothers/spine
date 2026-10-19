import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { startAiStub } from "./ai-stub";
import { api } from "./quote-seed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-AI-12", () => {
  test("a reminder from Receivables drafted Firm: the tone reaches the model, the balance is Spine's", async ({ page }) => {
    const stub = await startAiStub();
    try {
      await signUpNewOrg(page, { name: "Priya Raman", email: `us-ai-12-${randomUUID()}@example.com`, password: "TestPassword123!" });
      expect((await page.request.put(`${API_URL}/org/ai`, { headers: { "Idempotency-Key": randomUUID() }, data: { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3.5:4b", enabled: true } })).ok()).toBe(true);
      const customer = await api<{ id: string }>(page, "POST", "/contacts", { type: "customer", name: "Halcyon Tech Parks", email: "accounts@halcyon.example" });
      const draft = await api<{ id: string }>(page, "POST", "/invoices", { contactId: customer.id, currency: "USD", issueDate: "2026-08-01", dueDate: "2026-08-15", lines: [{ type: "item", name: "Slab works", quantity: 1, unitPriceAmount: "250000" }] });
      const invoice = await api<{ id: string; number: string }>(page, "POST", `/invoices/${draft.id}/issue`, {});
      stub.setReply({ subject: "Invoice {document_number} {due_status}", message: "{customer_name},\n\n{balance_due} on invoice {document_number} is overdue and needs paying this week.\n\n{business_name}" });

      await page.goto("/receivables?view=invoices");
      await page.getByRole("button", { name: `Actions for ${invoice.number}` }).click();
      await page.getByRole("menuitem", { name: /Send reminder/ }).click();
      const dialog = page.getByRole("dialog", { name: `Send payment reminder — ${invoice.number}` });
      const tone = dialog.getByLabel("Tone");
      await expect(tone.getByRole("radio", { name: "Friendly" })).toHaveAttribute("aria-checked", "true");
      await tone.getByRole("radio", { name: "Firm" }).click();
      await dialog.getByRole("button", { name: "Draft with AI" }).click();

      const suggestion = dialog.getByRole("region", { name: "AI's draft" });
      await expect(suggestion).toContainText("$2,500.00 on invoice");
      expect(stub.lastPrompt()).toContain("Tone: Firm");
      // Another tone on the suggestion drafts again in it.
      await suggestion.getByLabel("Tone").getByRole("radio", { name: "Formal" }).click();
      await expect.poll(() => stub.lastPrompt()).toContain("Tone: Formal");
      await expect(suggestion).toContainText("$2,500.00 on invoice");
    } finally {
      await stub.close();
    }
  });
});
