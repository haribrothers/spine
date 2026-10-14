import { randomUUID } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { signUpNewOrg } from "./helpers";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

export interface Stage {
  id: string;
  name: string;
  kind: "open" | "won" | "lost";
  color: string;
}

export interface LeadRow {
  id: string;
  title: string | null;
  stageId: string;
}

export async function api<T = unknown>(page: Page, method: "GET" | "POST" | "PUT", route: string, data?: unknown): Promise<T> {
  const res = await page.request.fetch(`${API_URL}${route}`, { method, data, headers: { "Idempotency-Key": randomUUID() } });
  expect(res.ok(), `${method} ${route}: ${res.status()} ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

/**
 * US-CRM-24 to 28 — a fresh organisation (no demo seed, so no queued
 * emails) with two contacts, ready for leads made through the API.
 */
export async function pipelineOrg(page: Page, ownerName = "Priya Raman") {
  const email = `e2e-pipeline-${randomUUID()}@example.com`;
  await signUpNewOrg(page, { name: ownerName, email, password: "e2e-test-password-1" });
  const ananya = await api<{ id: string }>(page, "POST", "/contacts", { name: "Ananya Rao", type: "customer" });
  const halcyon = await api<{ id: string }>(page, "POST", "/contacts", { name: "Halcyon Tech Parks Pvt Ltd", type: "customer" });
  const stages = await api<Stage[]>(page, "GET", "/org/lead-stages");
  const members = await api<{ userId: string; name: string }[]>(page, "GET", "/org/members");
  const stage = (name: string) => stages.find((s) => s.name === name)!;
  const addLead = (title: string, opts: { contactId?: string; stage?: string; value?: string; source?: string; ownerUserId?: string | null } = {}) =>
    api<LeadRow>(page, "POST", "/leads", {
      contactId: opts.contactId ?? ananya.id,
      title,
      valueCurrency: "INR",
      valueAmount: opts.value ?? "1000000",
      stageId: stage(opts.stage ?? "New").id,
      source: opts.source,
      ownerUserId: opts.ownerUserId,
    });
  return { email, contacts: { ananya: ananya.id, halcyon: halcyon.id }, stages, stage, me: members[0]!.userId, addLead };
}

/** A board column, open or slim, by its stage name. */
export function column(page: Page, stageName: string): Locator {
  return page.locator(`[data-stage="${stageName}"]`);
}

/** A lead's card by its title. */
export function card(page: Page, title: string): Locator {
  return page.locator("[data-lead]").filter({ has: page.getByText(title, { exact: true }) });
}

/** "⋯" → Move to… → a stage. The stage is chosen with Enter: near the right edge the submenu flips left, and Playwright's one-step pointer jump can land mid-flip. */
export async function moveVia(page: Page, title: string, to: string) {
  await card(page, title).getByRole("button", { name: `Actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Move to…" }).click();
  await page.getByRole("menuitem", { name: to, exact: true }).press("Enter");
}
