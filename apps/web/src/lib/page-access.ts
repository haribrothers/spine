import { SECTION_OPEN_CAPABILITIES, type Capability } from "@spine/shared";

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
  // US-SET-27 (D-220): every customer and team email.
  { prefix: "/emails", name: "Email log", ownerOnly: true },
  // US-RPT-16 (D-137)
  { prefix: "/opening-balances", name: "Opening balances", ownerOnly: true },
  { prefix: "/receivables", name: "Receivables", anyOf: ["reports.view_receivables"] },
  { prefix: "/payables", name: "Payables", anyOf: ["reports.view_payables"] },
  { prefix: "/banking", name: "Banking", anyOf: ["banking.view"] },
  // US-RPT-22
  { prefix: "/journals", name: "Journals", anyOf: ["ledger.view"] },
  {
    prefix: "/reports",
    name: "Reports",
    // US-RPT-23: the Reports page lists whatever reports the person can open.
    anyOf: ["reports.view_dashboard_summary", "reports.view_receivables", "reports.view_payables", "reports.view_job_profitability", "reports.view_financial_statements", "ledger.view"],
  },
  // US-TEAM-30 (D-235): a section closed for every one of a Staff member's Teams. Expenses always opens (their own).
  ...SECTION_OPEN_CAPABILITIES.filter((s) => s.href !== "/expenses").map((s) => ({ prefix: s.href, name: s.section, anyOf: [s.capability] })),
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
  "/vendor-credits": "Vendor Credits",
  "/vendor-payments": "Vendor Payments",
  "/payables": "Payables",
  "/banking": "Banking",
  "/journals": "Journals",
  "/reports": "Reports",
  "/team": "Team",
  "/emails": "Email log",
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
    if (FIELD_PAGES.some((p) => matches(pathname, p)) && !rule?.anyOf?.some((c) => c.startsWith("expense_categories."))) return { state: "allowed" };
    const prefix = Object.keys(PAGE_NAMES).find((p) => matches(pathname, p));
    return { state: "denied", pageName: prefix ? PAGE_NAMES[prefix]! : "this page", ownerOnly: rule?.ownerOnly ?? false, fixedRole: true };
  }

  if (!rule) return { state: "allowed" };
  if (rule.ownerOnly) return { state: "denied", pageName: rule.name, ownerOnly: true, fixedRole: false };
  if (!capabilities) return { state: "checking" };
  if (rule.anyOf?.some((c) => capabilities[c] === true)) return { state: "allowed" };
  return { state: "denied", pageName: rule.name, ownerOnly: false, fixedRole: false };
}
