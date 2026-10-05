import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect, logIn } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";
/** The demo seed's Staff user, in the default Team. */
const DEMO_STAFF_USER = { email: "sarah.mendes.demo@example.com", password: "DemoPassword123!" };

async function startQuote(page: Page) {
  await page.goto("/quotes/new");
  await page.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
  await page.getByPlaceholder("Search…").fill("Harborview");
  await page.getByRole("option", { name: /Harborview Construction Co\./ }).click();
  // Wait for the contact picker to hand focus back before typing elsewhere.
  await expect(page.getByRole("combobox").filter({ hasText: "Harborview Construction Co." })).toBeFocused();
  await page.getByRole("combobox", { name: "Item" }).click();
}

test.describe("US-CAT-06", () => {
  test("a name that matches no item offers a one-off line, and 'Also save to catalogue' adds it once the line has a price", async ({ page, seededOrg: _ }) => {
    await startQuote(page);
    const item = page.getByRole("combobox", { name: "Item" });
    const name = `Bathroom refit ${randomUUID().slice(0, 6)}`;
    await item.fill(name);
    const oneOff = page.getByRole("option", { name: `Use “${name}” as a one-off line` });
    await expect(oneOff).toBeVisible();
    await page.getByLabel("Also save to catalogue").check();
    await oneOff.click();
    await expect(page.getByText("Added to the catalogue when you save the quote — give it a price first.")).toBeVisible();

    await page.locator("div", { hasText: /^Unit price/ }).getByRole("textbox").fill("1250.00");
    await expect(page.getByText("Added to the catalogue when you save the quote.")).toBeVisible();
    await page.getByRole("button", { name: /Save as draft/ }).click();
    await page.waitForURL(/\/quotes\/[0-9a-f-]{36}$/);

    const items = (await (await page.request.get(`${API_URL}/catalog-items`)).json()) as { id: string; name: string; unit: string; defaultPriceAmount: string }[];
    const saved = items.find((i) => i.name === name);
    expect(saved).toMatchObject({ unit: "each", defaultPriceAmount: "125000" });
    const quoteId = page.url().split("/").pop()!;
    const quote = (await (await page.request.get(`${API_URL}/quotes/${quoteId}`)).json()) as { lines: { name: string; catalogItemId: string | null }[] };
    expect(quote.lines.find((l) => l.name === name)?.catalogItemId).toBe(saved!.id);
  });

  test("typing shows matching catalogue items with their price; choosing one fills the line", async ({ page, seededOrg: _ }) => {
    const items = (await (await page.request.get(`${API_URL}/catalog-items`)).json()) as { name: string; archivedAt: string | null }[];
    const existing = items.find((i) => !i.archivedAt)!;
    await startQuote(page);
    await page.getByRole("combobox", { name: "Item" }).fill(existing.name.slice(0, 6));
    const option = page.getByRole("option", { name: new RegExp(existing.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first();
    await expect(option).toBeVisible();
    await option.click();
    await expect(page.getByRole("combobox", { name: "Item" })).toHaveValue(existing.name);
  });

  test("without catalogue rights one-off lines still work but 'Also save to catalogue' is hidden", async ({ page, seededOrg: _, browser }) => {
    const teams = (await (await page.request.get(`${API_URL}/org/teams`)).json()) as { id: string; isDefault: boolean }[];
    const defaultTeam = teams.find((t) => t.isDefault)!;
    const res = await page.request.put(`${API_URL}/org/teams/${defaultTeam.id}/privileges`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { privileges: ["catalog.edit_own", "catalog.edit_others"].map((capability) => ({ capability, granted: false })) },
    });
    expect(res.ok()).toBe(true);

    const context = await browser.newContext();
    const staff = await context.newPage();
    await logIn(staff, DEMO_STAFF_USER);
    await startQuote(staff);
    await staff.getByRole("combobox", { name: "Item" }).fill("Skip bin hire");
    await expect(staff.getByRole("option", { name: "Use “Skip bin hire” as a one-off line" })).toBeVisible();
    await expect(staff.getByLabel("Also save to catalogue")).toHaveCount(0);
    await context.close();

    await page.request.put(`${API_URL}/org/teams/${defaultTeam.id}/privileges`, {
      headers: { "Idempotency-Key": randomUUID() },
      data: { privileges: ["catalog.edit_own", "catalog.edit_others"].map((capability) => ({ capability, granted: true })) },
    });
  });
});
