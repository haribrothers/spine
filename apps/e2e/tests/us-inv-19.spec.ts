import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

async function createContact(page: Page, type: "customer" | "vendor") {
  const res = await page.request.post(`${API_URL}/contacts`, {
    headers: { "Idempotency-Key": randomUUID() },
    data: { name: `Northgate Dental ${randomUUID().slice(0, 4)}`, type },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
}

test.describe("US-INV-19", () => {
  test("'Pause automatic reminders' on a customer's page keeps their invoices out of the reminder run", async ({ page, seededOrg: _ }) => {
    const contact = await createContact(page, "customer");
    await page.goto(`/contacts/${contact.id}`);
    const pause = page.getByRole("switch", { name: "Pause automatic reminders" });
    await expect(pause).not.toBeChecked();
    await pause.click();
    await expect(page.getByText(`${contact.name} won't get automatic payment reminders.`, { exact: true })).toBeVisible();
    await expect(pause).toBeChecked();

    const saved = (await (await page.request.get(`${API_URL}/contacts/${contact.id}`)).json()) as { remindersPaused: boolean };
    expect(saved.remindersPaused).toBe(true);
    await page.reload();
    await expect(page.getByRole("switch", { name: "Pause automatic reminders" })).toBeChecked();
  });

  test("vendors don't get the switch — they're never sent reminders", async ({ page, seededOrg: _ }) => {
    const vendor = await createContact(page, "vendor");
    await page.goto(`/contacts/${vendor.id}`);
    await expect(page.getByRole("heading", { name: vendor.name })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Pause automatic reminders" })).toHaveCount(0);
  });
});
