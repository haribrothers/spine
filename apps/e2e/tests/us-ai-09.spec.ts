import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";
import { billPdf, startAiStub } from "./ai-stub";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-AI-09", () => {
  test("Read receipt fills the expense, marks what it filled, warns of the same amount, and the expense submits as filled in with AI", async ({ page }) => {
    const stub = await startAiStub();
    try {
      await signUpNewOrg(page, { name: "Priya Raman", email: `us-ai-09-${randomUUID()}@example.com`, password: "TestPassword123!" });
      const post = async <T>(path: string, data: unknown) => {
        const res = await page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data });
        expect(res.ok(), await res.text()).toBe(true);
        return (await res.json()) as T;
      };
      expect((await page.request.put(`${API_URL}/org/ai`, { headers: { "Idempotency-Key": randomUUID() }, data: { driver: "openai-compatible", baseUrl: stub.url, model: "qwen3-vl:8b", enabled: true } })).ok()).toBe(true);
      const grouped = (await (await page.request.get(`${API_URL}/org/accounts`)).json()) as Record<string, { id: string; code: string }[]>;
      const fuel = await post<{ id: string }>("/expense-categories", { name: "Fuel & freight", accountId: Object.values(grouped).flat().find((a) => a.code === "6900")!.id });
      // Already submitted: the same amount on the same day.
      await post("/expenses", { categoryId: fuel.id, date: "2026-10-13", currency: "USD", amount: "4850", description: "Diesel" });
      stub.setReply({ merchant: "HP Fuel Centre", whatWasBought: "diesel, 5.2 gal", date: "2026-10-13", currency: "USD", total: "48.50", taxAmount: null, category: "Fuel & freight" });

      await page.goto("/expenses");
      await page.getByRole("button", { name: "Submit expense" }).first().click();
      const form = page.getByRole("dialog", { name: "Submit an expense" });
      await form.getByLabel("Choose receipt and files").setInputFiles({ name: "diesel-13-oct.pdf", mimeType: "application/pdf", buffer: billPdf(["HP FUEL CENTRE", "Diesel 5.2 gal 48.50"]) });
      await expect(form.getByTestId("receipt-preview")).toBeVisible();

      // Labour mode doesn't offer it.
      await form.getByRole("radio", { name: "Headcount × day rate" }).click();
      await expect(form.getByRole("button", { name: "Read receipt" })).toHaveCount(0);
      await form.getByRole("radio", { name: "Amount" }).click();

      await form.getByRole("button", { name: "Read receipt" }).click();
      await expect(form.getByTestId("expense-ai-filled")).toContainText("Filled in from the receipt. Check the fields marked Suggested by AI before you submit.");
      await expect(form.getByRole("textbox", { name: "Amount", exact: true })).toHaveValue("48.50");
      await expect(form.getByRole("textbox", { name: "Description" })).toHaveValue("HP Fuel Centre — diesel, 5.2 gal");
      await expect(form).toContainText("the receipt · read by AI");
      await expect(form.getByRole("button", { name: "Read again" })).toBeVisible();
      await expect(form.getByTestId("expense-duplicate-warning")).toContainText("You submitted $48.50");
      const marks = form.getByTestId("ai-suggested");
      const before = await marks.count();
      expect(before).toBeGreaterThanOrEqual(4);

      await form.getByRole("textbox", { name: "Description" }).fill("HP Fuel Centre — JCB diesel");
      await expect(marks).toHaveCount(before - 1);

      await form.getByRole("button", { name: "Submit expense" }).click();
      await expect(form).toHaveCount(0);
      const rows = (await (await page.request.get(`${API_URL}/expenses`)).json()) as { id: string; description: string | null }[];
      const saved = rows.find((r) => r.description === "HP Fuel Centre — JCB diesel")!;
      await page.goto(`/expenses/${saved.id}`);
      await expect(page.getByTestId("expense-activity-entry").filter({ hasText: "Submitted for approval" })).toContainText("filled in with AI");
    } finally {
      await stub.close();
    }
  });
});
