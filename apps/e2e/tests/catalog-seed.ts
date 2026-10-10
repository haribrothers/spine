import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

export interface SeedItem {
  name: string;
  price: string;
  category?: string;
  description?: string;
  unit?: string;
  taxed?: boolean;
  currency?: string;
}

/** US-CAT-10 to 15 — a POST as the signed-in person. */
export function apiPost(page: Page, path: string, data: unknown) {
  return page.request.post(`${API_URL}${path}`, { headers: { "Idempotency-Key": randomUUID() }, data });
}

/** Adds a "Sales tax 8%" rate and the items; returns the rate and the items' ids by name. */
export async function seedCatalog(page: Page, items: SeedItem[]): Promise<{ rateId: string; ids: Record<string, string> }> {
  const rate = (await (await apiPost(page, "/tax-rates", { name: "Sales tax 8%", rate: 8 })).json()) as { id: string };
  const ids: Record<string, string> = {};
  for (const it of items) {
    const res = await apiPost(page, "/catalog-items", {
      name: it.name,
      description: it.description,
      category: it.category,
      unit: it.unit ?? "each",
      defaultPriceAmount: it.price,
      defaultPriceCurrency: it.currency ?? "USD",
      defaultTaxRateId: it.taxed === false ? undefined : rate.id,
    });
    ids[it.name] = ((await res.json()) as { id: string }).id;
  }
  return { rateId: rate.id, ids };
}
