import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-AI-03 · US-AI-04", () => {
  test("an Owner switches a feature off, reads what each sends, and sets a monthly budget", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-ai-03-${randomUUID()}@example.com`, password: "TestPassword123!" });
    // A local provider, switched on (US-AI-01/02 cover setting it up through the pane). Nothing here calls it.
    const put = (data: unknown) => page.request.put(`${API_URL}/org/ai`, { headers: { "Idempotency-Key": randomUUID() }, data });
    expect((await put({ driver: "openai-compatible", baseUrl: "http://127.0.0.1:11434/v1", model: "qwen3-vl:8b", enabled: true })).ok()).toBe(true);

    await page.goto("/dashboard?settings=ai");
    const features = page.getByTestId("ai-features");
    await expect(features.getByRole("switch")).toHaveCount(4);

    // US-AI-03: what's sent, then a switch.
    await features.getByRole("button", { name: "What's sent" }).nth(2).click();
    await expect(features).toContainText("Sent: the enquiry and up to 50 matching catalogue items and bundles.");
    await expect(features).toContainText("Never sent: bank account numbers, tax IDs and GSTINs, UPI IDs, passwords or keys.");
    await features.getByRole("switch", { name: "Suggest bank matches" }).click();
    await expect(page.getByTestId("toast").getByText("Suggest bank matches is off").first()).toBeVisible();
    await expect(features.getByRole("switch", { name: "Suggest bank matches" })).toHaveAttribute("aria-checked", "false");
    const status = await (await page.request.get(`${API_URL}/ai/status`)).json();
    expect(status.features.bankSuggestions).toBe(false);

    // US-AI-04: a budget, and this month's usage against it.
    const budget = page.getByTestId("ai-budget");
    await budget.getByLabel("Tokens a month").fill("2,000,000");
    await page.getByTestId("ai-pane").getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("toast").getByText("Monthly budget saved").first()).toBeVisible();
    await expect(budget.getByTestId("ai-usage")).toContainText("of 2,000,000 tokens · 0%");
    expect((await (await page.request.get(`${API_URL}/org/ai`)).json()).monthlyTokenBudget).toBe(2_000_000);
  });
});
