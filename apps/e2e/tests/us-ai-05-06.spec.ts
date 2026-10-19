import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

test.describe("US-AI-05 · US-AI-06", () => {
  test("an Owner gives a Team the AI right in its draft, and a bill saved from AI says so in its Activity", async ({ page }) => {
    await signUpNewOrg(page, { name: "Owner", email: `us-ai-05-${randomUUID()}@example.com`, password: "TestPassword123!" });
    const headers = () => ({ "Idempotency-Key": randomUUID() });
    expect((await page.request.put(`${API_URL}/org/ai`, { headers: headers(), data: { driver: "openai-compatible", baseUrl: "http://127.0.0.1:11434/v1", model: "qwen3-vl:8b", enabled: true } })).ok()).toBe(true);

    // US-AI-05: the AI assistant group, off for General Staff, changed in the draft.
    const teams = await (await page.request.get(`${API_URL}/org/teams`)).json();
    const team = teams.find((t: { isDefault: boolean }) => t.isDefault);
    await page.goto(`/team/teams/${team.id}`);
    await page.getByRole("tab", { name: "Permissions" }).click();
    await page.getByText("AI assistant", { exact: true }).click();
    const useAi = page.getByRole("switch", { name: "Use AI features" });
    await expect(useAi).toHaveAttribute("aria-checked", "false");
    await useAi.click();
    await expect(page.getByTestId("ai-not-a-section")).toContainText("AI isn't a section.");
    await page.getByRole("button", { name: "Save changes" }).click();
    // Save asks first, listing what turns on (US-TEAM-28).
    await expect(page.getByText("Use AI features").last()).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).last().click();
    await expect.poll(async () => (await (await page.request.get(`${API_URL}/org/teams/${team.id}`)).json()).privileges?.["ai.use"] ?? null).toBe(true);

    // US-AI-06: a bill saved from fields AI filled in.
    const vendor = await (await page.request.post(`${API_URL}/contacts`, { headers: headers(), data: { type: "vendor", name: "Apex Building Materials" } })).json();
    const bill = await (await page.request.post(`${API_URL}/vendor-bills`, { headers: headers(), data: { contactId: vendor.id, billNumber: "ABM-20611", date: "2026-10-14", currency: "USD", lines: [], aiAssisted: true } })).json();
    await page.goto(`/vendor-bills/${bill.id}`);
    await expect(page.getByTestId("bill-activity-entry").filter({ hasText: "Created as a draft" })).toContainText("Created as a draft · filled in with AI");
  });
});
