import type { Page } from "@playwright/test";

/**
 * Every web route the audits visit, shared by the accessibility check (US-OPS-17) and the
 * phone check (US-OPS-62), so a new route is checked by both. Add a route here, not in a spec.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4110";

/** Every app page that needs no id (apps/web/src/app/(app)). */
export const PAGES = [
  "/dashboard", "/setup", "/activity", "/profile", "/contacts", "/contacts/new", "/leads", "/meetings", "/catalog", "/quotes", "/quotes/new",
  "/jobs", "/invoices", "/invoices/new", "/invoices/recurring", "/credit-notes", "/payments", "/receivables", "/emails",
  "/vendor-bills", "/vendor-bills/new", "/vendor-bills/recurring", "/vendor-credits", "/vendor-credits/new", "/expenses", "/expenses/categories",
  "/vendor-payments", "/payables", "/banking", "/journals", "/opening-balances", "/reports", "/reports/profit-and-loss", "/reports/balance-sheet",
  "/reports/cash-flow", "/reports/trial-balance", "/reports/general-ledger", "/reports/day-book", "/reports/tax-summary", "/reports/sales-by-customer",
  "/reports/sales-by-item", "/reports/purchases-by-vendor", "/reports/expenses-by-category", "/reports/payments-received", "/reports/payments-made",
  "/reports/credit-notes-and-refunds", "/reports/vendor-credits", "/reports/job-profitability", "/reports/tally", "/reports/tally/mapping",
  "/team/users", "/team/teams", "/team/audit-log", "/no-such-page",
];

/** One record of each kind from the demo data: [list endpoint, page]. */
export const RECORDS: [string, (id: string) => string][] = [
  ["/contacts", (id) => `/contacts/${id}`],
  ["/quotes", (id) => `/quotes/${id}`],
  ["/invoices", (id) => `/invoices/${id}`],
  ["/jobs", (id) => `/jobs/${id}`],
  ["/payments", (id) => `/payments/${id}`],
  ["/credit-notes", (id) => `/credit-notes/${id}`],
  ["/expenses", (id) => `/expenses/${id}`],
  ["/money-accounts", (id) => `/banking/${id}`],
  ["/org/teams", (id) => `/team/teams/${id}`],
];

/** Settings panes, opened over the dashboard (US-SET-33). */
export const PANES = [
  "profile", "security", "notifications", "my-connected-agents", "about", "business", "branding", "template", "currency", "modules", "ai", "agents",
  "fiscal-year", "tax", "accounts", "opening-balances", "payment-instructions", "numbering", "documents", "emails", "reminders", "lead-stages",
  "quote-conversion-guard", "dashboard-meetings-scope", "meeting-reminder-lead-time", "data-export", "data",
];

export async function firstId(page: Page, path: string): Promise<string | null> {
  const res = await page.request.get(`${API_URL}${path}`);
  if (!res.ok()) return null;
  const body = (await res.json()) as unknown;
  const rows = Array.isArray(body) ? body : ((body as { items?: unknown[]; data?: unknown[]; rows?: unknown[] }).items ?? (body as { data?: unknown[] }).data ?? (body as { rows?: unknown[] }).rows ?? []);
  return ((rows[0] as { id?: string } | undefined)?.id) ?? null;
}

/** The pages with no id plus one record of each kind. */
export async function appRoutes(page: Page): Promise<string[]> {
  const targets = [...PAGES];
  for (const [list, to] of RECORDS) {
    const id = await firstId(page, list);
    if (id) targets.push(to(id));
  }
  return targets;
}

export async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(300);
}
