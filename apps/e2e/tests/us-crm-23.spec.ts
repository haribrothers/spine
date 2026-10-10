import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

/** Adds the contact once per seeded org (the org is shared by every test in this file). */
async function ensureContact(page: Page, data: { type: string; name: string; email?: string; phone?: string }) {
  const existing = (await (await page.request.get(`${API_URL}/contacts?includeArchived=true`)).json()) as { name: string }[];
  if (existing.some((c) => c.name === data.name)) return;
  expect((await page.request.post(`${API_URL}/contacts`, { headers: { "Idempotency-Key": randomUUID() }, data })).ok()).toBe(true);
}

const addZylo = (page: Page) => ensureContact(page, { type: "vendor", name: "Zylo Scaffolding Hire", email: "hire@zylo.example" });

const search = (page: Page) => page.getByRole("searchbox", { name: "Search contacts" });

test.describe("US-CRM-23", () => {
  test("search works in every view and stays, with the filters, when I open a contact and come back", async ({ page, seededOrg: _ }) => {
    test.setTimeout(120_000);
    await addZylo(page);
    await page.goto("/contacts");

    for (const view of ["Card view", "List view", "Table view"]) {
      await page.getByRole("radio", { name: view }).click();
      await search(page).fill("zylo");
      await expect(page.getByText("Zylo Scaffolding Hire")).toBeVisible();
      await expect(page).toHaveURL(/[?&]q=zylo/);
      await search(page).fill("");
    }
    // In the Table view the search row has Columns on its right.
    await expect(page.getByRole("button", { name: /Columns/ })).toBeVisible();

    await page.getByRole("radio", { name: "Card view" }).click();
    await search(page).fill("hire@zylo");
    await page.getByRole("link", { name: /Zylo Scaffolding Hire/ }).first().click();
    await page.waitForURL(/\/contacts\/[0-9a-f-]+$/);
    await page.goBack();
    await expect(search(page)).toHaveValue("hire@zylo");
    await expect(page.getByText("Zylo Scaffolding Hire")).toBeVisible();

    // Nothing matches: say so, and clear the search.
    await search(page).fill("no such contact");
    await expect(page.getByText('No contacts match "no such contact"')).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search(page)).toHaveValue("");
    await expect(page).toHaveURL(/\/contacts$/);
  });

  test("stat cards count every active contact and filter by type; the page and filters survive a reload of the address", async ({ page, seededOrg: _ }) => {
    test.setTimeout(120_000);
    await addZylo(page);
    await page.goto("/contacts");
    await page.getByRole("radio", { name: "Table view" }).click();

    const stats = page.getByTestId("contact-stats");
    const customers = stats.getByRole("button", { name: /^Show customers, \d+$/ });
    const vendors = stats.getByRole("button", { name: /^Show vendors, \d+$/ });
    const before = await customers.getAttribute("aria-label");

    await vendors.click();
    await expect(vendors).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/type=vendor&type=both/);
    const types = await page.locator("tbody tr td:nth-child(2)").allTextContents();
    expect(types.length).toBeGreaterThan(0);
    expect(types.every((t) => t === "Vendor" || t === "Customer & vendor")).toBe(true);
    // The counts don't change with the filter.
    await expect(customers).toHaveAttribute("aria-label", before!);
    await vendors.click();
    await expect(vendors).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(/\/contacts$/);

    await expect(stats.getByRole("link", { name: /^Open the pipeline/ })).toHaveAttribute("href", "/leads");

    // A filter from the address that matches nothing: Clear filters clears the search too.
    await page.goto("/contacts?status=archived&q=zylo");
    await expect(page.getByText("No contacts match these filters")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/contacts$/);
    await expect(search(page)).toHaveValue("");

    // The page stays after a refresh (the table shows 10 a page).
    await page.getByRole("radio", { name: "Table view" }).click();
    const next = page.getByRole("button", { name: "Next page" });
    if (await next.isEnabled()) {
      await next.click();
      await expect(page).toHaveURL(/page=2/);
      await page.getByRole("button", { name: "Refresh list" }).click();
      await expect(page.getByTestId("contacts-updated")).toHaveText("Updated just now");
      await expect(page).toHaveURL(/page=2/);
      await expect(page.getByRole("button", { name: "2", exact: true })).toHaveAttribute("aria-current", "page");
    }
  });
});
