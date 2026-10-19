import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { startAiStub } from "./ai-stub";
import { api } from "./quote-seed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-AI-11", () => {
  test("Draft with AI suggests a reminder with the invoice's own details; using it and sending it goes through the email log", async ({ page }) => {
    const stub = await startAiStub();
    try {
      await signUpNewOrg(page, { name: "Priya Raman", email: `us-ai-11-${randomUUID()}@example.com`, password: "TestPassword123!" });
      expect((await page.request.put(`${API_URL}/org/ai`, { headers: { "Idempotency-Key": randomUUID() }, data: { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3.5:4b", enabled: true } })).ok()).toBe(true);
      const customer = await api<{ id: string }>(page, "POST", "/contacts", { type: "customer", name: "Halcyon Tech Parks", email: "accounts@halcyon.example" });
      const draft = await api<{ id: string }>(page, "POST", "/invoices", { contactId: customer.id, currency: "USD", issueDate: "2026-08-01", dueDate: "2026-08-15", lines: [{ type: "item", name: "Slab works", quantity: 1, unitPriceAmount: "250000" }] });
      const invoice = await api<{ id: string; number: string }>(page, "POST", `/invoices/${draft.id}/issue`, {});
      stub.setReply({
        subject: "Invoice {document_number} {due_status} — please arrange payment",
        message: "Hi {customer_name},\n\nInvoice {document_number} for {amount} is still outstanding.\n\nRegards,\n{business_name}",
      });

      await page.goto(`/invoices/${invoice.id}`);
      await page.getByRole("button", { name: "Send reminder" }).first().click();
      const dialog = page.getByRole("dialog", { name: `Send payment reminder — ${invoice.number}` });
      const subject = dialog.getByLabel("Subject");
      const message = dialog.getByRole("textbox", { name: "Message" });
      // The template, with the invoice's details highlighted.
      await expect(subject).toHaveValue(new RegExp(`^Reminder: invoice ${invoice.number} is \\d+ days overdue$`));
      await expect(message.locator("[data-highlight]").filter({ hasText: invoice.number })).toHaveCount(1);
      const template = await subject.inputValue();

      await dialog.getByRole("button", { name: "Draft with AI" }).click();
      const suggestion = dialog.getByRole("region", { name: "AI's draft" });
      await expect(suggestion).toContainText(`Invoice ${invoice.number} for $2,500.00 is still outstanding.`);
      await expect(suggestion.locator("[data-highlight]").filter({ hasText: "$2,500.00" })).toHaveCount(1);
      // Nothing in the email changes until it's used.
      await expect(subject).toHaveValue(template);

      await suggestion.getByRole("button", { name: "Use this draft" }).click();
      await expect(subject).toHaveValue(new RegExp(`^Invoice ${invoice.number} is \\d+ days overdue — please arrange payment$`));
      await expect(message).toContainText("for $2,500.00 is still outstanding");
      await expect(dialog.getByText("Drafted by AI")).toHaveCount(2);
      await expect(dialog.getByTestId("ai-email-used")).toContainText("Using AI's draft — check it before sending.");

      await dialog.getByRole("button", { name: "Send reminder" }).click();
      await expect(page.getByText("Reminder sent", { exact: true }).first()).toBeVisible();
      await expect.poll(async () => (await api<{ entityId: string | null; subject: string }[]>(page, "GET", "/emails")).find((e) => e.entityId === invoice.id)?.subject, { timeout: 30_000 }).toMatch(/please arrange payment$/);
    } finally {
      await stub.close();
    }
  });
});
