import type { Capability } from "@spine/shared";

export type PageAccess =
  | { state: "allowed" }
  | { state: "checking" }
  | { state: "denied"; pageName: string; ownerOnly: boolean; fixedRole: boolean };

interface PageRule {
  prefix: string;
  name: string;
  /** Only Owners can ever open it (never Team-configurable). */
  ownerOnly?: boolean;
  /** Staff need at least one of these. */
  anyOf?: Capability[];
}

/** Pages a Field user can open; everything else is refused (US-TEAM-18). */
const FIELD_PAGES = ["/dashboard", "/activity", "/jobs", "/meetings", "/expenses", "/profile"];

const RULES: PageRule[] = [
  // US-PUR-19: more specific than "/expenses", which every role can open.
  { prefix: "/expenses/categories", name: "Expense categories", anyOf: ["expense_categories.edit_own", "expense_categories.edit_others"] },
  { prefix: "/team", name: "Team", ownerOnly: true },
  { prefix: "/receivables", name: "Receivables", anyOf: ["reports.view_receivables"] },
  { prefix: "/payables", name: "Payables", anyOf: ["reports.view_payables"] },
  {
    prefix: "/reports",
    name: "Reports",
    anyOf: ["reports.view_dashboard_summary", "reports.view_receivables", "reports.view_payables", "reports.view_job_profitability"],
  },
];

/** Names for pages Field can't open, as the sidebar labels them. */
const PAGE_NAMES: Record<string, string> = {
  "/contacts": "Contacts",
  "/leads": "Pipeline",
  "/catalog": "Catalogue",
  "/quotes": "Quotes",
  "/invoices": "Invoices",
  "/credit-notes": "Credit Notes",
  "/payments": "Payments",
  "/receivables": "Receivables",
  "/vendor-bills": "Vendor Bills",
  "/vendor-payments": "Vendor Payments",
  "/payables": "Payables",
  "/reports": "Reports",
  "/team": "Team",
  "/expenses/categories": "Expense categories",
};

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * US-OPS-12 — whether this person may open the page at `pathname`, so the
 * layout shows the no-access page instead of mounting it (and loading any
 * of its data). Mirrors the API's rules; the API stays authoritative.
 */
export function pageAccessFor(pathname: string, role: string | null, capabilities: Partial<Record<Capability, boolean>> | null): PageAccess {
  if (role === "owner") return { state: "allowed" };
  const rule = RULES.find((r) => matches(pathname, r.prefix));

  if (role === "field") {
    // Field's capabilities are fixed and never include expense categories.
    if (!rule?.anyOf && FIELD_PAGES.some((p) => matches(pathname, p))) return { state: "allowed" };
    const prefix = Object.keys(PAGE_NAMES).find((p) => matches(pathname, p));
    return { state: "denied", pageName: prefix ? PAGE_NAMES[prefix]! : "this page", ownerOnly: rule?.ownerOnly ?? false, fixedRole: true };
  }

  if (!rule) return { state: "allowed" };
  if (rule.ownerOnly) return { state: "denied", pageName: rule.name, ownerOnly: true, fixedRole: false };
  if (!capabilities) return { state: "checking" };
  if (rule.anyOf?.some((c) => capabilities[c] === true)) return { state: "allowed" };
  return { state: "denied", pageName: rule.name, ownerOnly: false, fixedRole: false };
}
