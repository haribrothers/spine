import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

interface QuoteLine {
  type: string;
  name: string;
  catalogItemId: string | null;
  unitPriceAmount: string;
}

async function api<T>(page: Page, method: "get" | "post", route: string, data?: unknown): Promise<T> {
  const res = await page.request[method](`${API_URL}${route}`, { data, headers: { "Idempotency-Key": randomUUID() } });
  expect(res.ok(), `${method} ${route}: ${res.status()}`).toBe(true);
  return (await res.json()) as T;
}

async function pickContact(page: Page) {
  await page.getByRole("combobox").filter({ hasText: "Select a contact…" }).click();
  await page.getByPlaceholder("Search…").fill("Harborview");
  await page.getByRole("option", { name: /Harborview Construction Co\./ }).click();
  await expect(page.getByRole("combobox").filter({ hasText: "Harborview Construction Co." })).toBeFocused();
}

test.describe("US-QUO-26", () => {
  test("bundles come first in the picker on quotes and invoices and add their lines in order; an archived item's line is added as a one-off", async ({ page, seededOrg: _ }) => {
    // A bundle saved from a demo quote with several item lines.
    const quotes = await api<{ id: string }[]>(page, "get", "/quotes");
    let source: { id: string; lines: QuoteLine[] } | undefined;
    for (const q of quotes) {
      const full = await api<{ id: string; lines: QuoteLine[] }>(page, "get", `/quotes/${q.id}`);
      if (full.lines.filter((l) => l.type === "item" && l.catalogItemId).length >= 2) {
        source = full;
        break;
      }
    }
    expect(source, "a demo quote with two catalogue lines").toBeTruthy();
    const name = `Bathroom refit — standard ${randomUUID().slice(0, 4)}`;
    const bundle = await api<{ id: string; lines: QuoteLine[] }>(page, "post", "/catalog-bundles", { name, sourceQuoteId: source!.id });
    const archivedLine = bundle.lines.find((l) => l.catalogItemId)!;
    await api(page, "post", `/catalog-items/${archivedLine.catalogItemId}/archive`);

    await page.goto("/quotes/new");
    await pickContact(page);
    const item = page.getByRole("combobox", { name: "Item" });
    await item.click();
    await item.fill(name.slice(0, 14));
    const listbox = page.getByRole("listbox", { name: "Catalogue matches" });
    await expect(listbox.getByText("Bundles", { exact: true })).toBeVisible();
    const option = listbox.getByRole("option", { name: new RegExp(`^${name}`) });
    const itemNames = bundle.lines.filter((l) => l.type === "item").map((l) => l.name);
    await expect(option).toContainText(`Adds ${itemNames.length} lines: ${itemNames.join(", ")}`);
    await option.click();

    // The bundle's lines replace the line it was picked on, in order, each editable.
    const names = page.getByRole("combobox", { name: "Item" });
    await expect(names).toHaveCount(bundle.lines.filter((l) => l.type === "item").length);
    await expect(names.first()).toHaveValue(itemNames[0]!);
    await names.first().fill(`${itemNames[0]} (edited)`);

    await page.getByRole("button", { name: /Save as draft/ }).click();
    await page.waitForURL(/\/quotes\/[0-9a-f-]{36}$/);
    const saved = await api<{ lines: QuoteLine[] }>(page, "get", `/quotes/${page.url().split("/").pop()}`);
    expect(saved.lines.map((l) => l.unitPriceAmount)).toEqual(bundle.lines.map((l) => l.unitPriceAmount));
    expect(saved.lines.find((l) => l.name === archivedLine.name || l.name === `${archivedLine.name} (edited)`)?.catalogItemId).toBeNull();

    // Invoices offer the same bundles.
    await page.goto("/invoices/new");
    const invoiceItem = page.getByRole("combobox", { name: "Item" });
    await invoiceItem.click();
    await invoiceItem.fill(name.slice(0, 14));
    await expect(page.getByRole("listbox", { name: "Catalogue matches" }).getByRole("option", { name: new RegExp(`^${name}`) })).toBeVisible();

    await api(page, "post", `/catalog-items/${archivedLine.catalogItemId}/restore`);
  });

  test("vendor bills show items only, no bundles", async ({ page, seededOrg: _ }) => {
    await page.goto("/vendor-bills/new");
    await expect(page.getByRole("listbox", { name: "Catalogue matches" })).toHaveCount(0);
    await expect(page.getByText(/Adds \d+ lines?:/)).toHaveCount(0);
  });
});
