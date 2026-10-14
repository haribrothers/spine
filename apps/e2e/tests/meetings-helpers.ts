import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

export async function api<T = unknown>(page: Page, method: "GET" | "POST", route: string, data?: unknown): Promise<T> {
  const res = await page.request.fetch(`${API_URL}${route}`, { method, data, headers: { "Idempotency-Key": randomUUID() } });
  expect(res.ok(), `${method} ${route}: ${res.status()} ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

/** A local date and time; months are 1-based here. */
export const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

/** YYYY-MM-DD for a local date. */
export const dayParam = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/**
 * US-MTG-13 to US-MTG-17 — a fresh organisation (no demo seed, so no
 * queued emails) with one contact, ready for meetings made through the API.
 */
export async function meetingsOrg(page: Page, ownerName = "Priya Raman") {
  await signUpNewOrg(page, { name: ownerName, email: `e2e-meetings-${randomUUID()}@example.com`, password: "e2e-test-password-1" });
  const contact = await api<{ id: string }>(page, "POST", "/contacts", { name: "Halcyon Tech Parks Pvt Ltd", type: "customer" });
  const addMeeting = (title: string, start: Date, end: Date, extra: Record<string, unknown> = {}) =>
    api<{ id: string }>(page, "POST", "/meetings", { title, startAt: start.toISOString(), endAt: end.toISOString(), color: "blue", ...extra });
  return { contactId: contact.id, ownerName, addMeeting };
}

/** A mini calendar day by its accessible name's start, e.g. "Wednesday, March 10, 2027". */
export function miniDay(page: Page, name: RegExp) {
  return page.getByRole("complementary", { name: "Calendar sidebar" }).getByRole("gridcell", { name });
}
