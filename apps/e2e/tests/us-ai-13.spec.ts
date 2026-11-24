import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { startAiStub } from "./ai-stub";
import { seedCatalog } from "./catalog-seed";
import { api } from "./quote-seed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-AI-13", () => {
  test("Draft lines with AI proposes lines from an enquiry; the ticked ones join the quote as rows marked until changed, and the quote saves as filled in with AI", async ({ page }) => {
    const stub = await startAiStub();
    try {
      await signUpNewOrg(page, { name: "Priya Raman", email: `us-ai-13-${randomUUID()}@example.com`, password: "TestPassword123!" });
      expect((await page.request.put(`${API_URL}/org/ai`, { headers: { "Idempotency-Key": randomUUID() }, data: { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3.5:4b", enabled: true } })).ok()).toBe(true);
      await seedCatalog(page, [{ name: "Floor & wall tiling", price: "950", unit: "sq ft", description: "Supply and fix vitrified tiles" }]);
      const customer = await api<{ id: string }>(page, "POST", "/contacts", { type: "customer", name: "Ananya Rao" });
      const quote = await api<{ id: string }>(page, "POST", "/quotes", { contactId: customer.id, currency: "USD", title: "Bathroom refit", lines: [] });
      // The only catalogue entry is I1.
      stub.setReply({
        lines: [
          { ref: "I1", name: "Retile floor and walls", description: "Approx 120 sq ft", quantity: 120 },
          { ref: null, name: "Glass shower screen", description: null, quantity: 1 },
        ],
      });

      await page.goto(`/quotes/${quote.id}/edit`);
      await page.getByRole("button", { name: "Draft lines with AI" }).click();
      const panel = page.getByTestId("quote-ai-panel");
      await panel.getByLabel("Enquiry").fill("Hi, we'd like the bathroom redone: retile floor and walls (approx 120 sq ft) and a glass screen for the shower. — Ananya");
      await panel.getByRole("button", { name: "Draft lines" }).click();
      const proposed = panel.getByRole("region", { name: "Proposed lines" });
      await expect(proposed).toContainText("Floor & wall tiling");
      await expect(proposed).toContainText("Catalogue item · per sq ft");
      await expect(proposed).toContainText("$9.50");
      await expect(proposed).toContainText("Not in your catalogue");
      await expect(proposed).toContainText("Add a price");
      await expect(panel).toContainText("Drafted from the enquiry and 1 catalogue item");
      await expect(panel).toContainText("2 of 2 ticked");

      // Closing without adding leaves the quote as it was; the proposal is still there on reopening.
      await panel.getByRole("button", { name: "Close" }).last().click();
      await expect(page.getByTestId("quote-lines").getByRole("group")).toHaveCount(0);
      await page.getByRole("button", { name: "Draft lines with AI" }).click();
      await page.getByTestId("quote-ai-panel").getByRole("button", { name: "Add to quote (2)" }).click();

      const rows = page.getByTestId("quote-lines").getByRole("group");
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0).getByRole("textbox", { name: "Description" })).toHaveValue("Approx 120 sq ft");
      // 120 × $9.50, with the item's own 8% tax — a taxable line, as picking the item by hand makes it.
      await expect(rows.nth(0).getByTestId("line-amount")).toHaveText("$1,231.20");
      await expect(rows.nth(0).getByText("Zero-rated")).toHaveCount(0);
      await expect(rows.nth(1).getByTestId("ai-price-note")).toHaveText("Add a price — not in your catalogue.");
      await expect(page.getByTestId("quote-lines").getByTestId("ai-suggested")).toHaveCount(2);

      // Changing a line takes its mark away; giving the screen a price takes its note away.
      await rows.nth(0).getByLabel("Quantity").fill("110");
      await expect(page.getByTestId("quote-lines").getByTestId("ai-suggested")).toHaveCount(1);
      await rows.nth(1).getByLabel("Unit price").fill("450");
      await expect(rows.nth(1).getByTestId("ai-price-note")).toHaveCount(0);

      await page.getByRole("button", { name: /Save (as )?draft/ }).click();
      await expect(page).toHaveURL(new RegExp(`/quotes/${quote.id}$`));
      await expect(page.getByTestId("ai-filled").first()).toBeVisible();
    } finally {
      await stub.close();
    }
  });
});
