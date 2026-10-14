import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

/** US-QUO-27 to US-QUO-36 — calls as the signed-in person. */
export async function api<T = { id: string }>(page: Page, method: "POST" | "PUT" | "GET", path: string, data?: unknown): Promise<T> {
  const res = await page.request.fetch(`${API_URL}${path}`, { method, headers: { "Idempotency-Key": randomUUID() }, data });
  if (!res.ok()) throw new Error(`${method} ${path} → ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

export function isoDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function contact(page: Page, name: string) {
  return api(page, "POST", "/contacts", { type: "customer", name, email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.com` });
}

export async function quote(
  page: Page,
  contactId: string,
  opts: { title?: string; validDays?: number; lines?: { name: string; price: string; quantity?: number; description?: string }[] } = {},
) {
  const lines = (opts.lines ?? [{ name: "Site visit", price: "100000" }]).map((l) => ({ type: "item", name: l.name, description: l.description, quantity: l.quantity ?? 1, unitPriceAmount: l.price }));
  return api<{ id: string; number: string | null }>(page, "POST", "/quotes", {
    contactId,
    currency: "USD",
    title: opts.title,
    validUntil: opts.validDays === undefined ? undefined : isoDays(opts.validDays),
    lines,
  });
}

export async function send(page: Page, quoteId: string) {
  return api<{ id: string; number: string }>(page, "POST", `/quotes/${quoteId}/send`, {});
}

/** A fresh customer link's token. */
export async function linkToken(page: Page, quoteId: string): Promise<string> {
  const link = await api<{ url: string }>(page, "POST", `/quotes/${quoteId}/link`);
  return decodeURIComponent(link.url.split("/quote/")[1]!);
}

export async function view(page: Page, token: string) {
  await page.request.get(`${API_URL}/public/quotes/${encodeURIComponent(token)}`);
}

export async function accept(page: Page, token: string, comment?: string) {
  await page.request.post(`${API_URL}/public/quotes/${encodeURIComponent(token)}/accept`, { data: { comment } });
}
