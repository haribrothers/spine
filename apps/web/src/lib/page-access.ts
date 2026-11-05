import { SECTION_OPEN_CAPABILITIES, type Capability } from "@spine/shared";
import { t } from "./i18n";

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
  { prefix: "/expenses/categories", name: t("common.pageAccess.expenseCategories"), anyOf: ["expense_categories.edit_own", "expense_categories.edit_others"] },
  { prefix: "/team", name: t("common.nav.sections.team"), ownerOnly: true },
  // US-SET-27 (D-220): every customer and team email.
  { prefix: "/emails", name: t("common.pageAccess.emailLog"), ownerOnly: true },
  // US-RPT-16 (D-137)
  { prefix: "/opening-balances", name: t("common.pageAccess.openingBalances"), ownerOnly: true },
  { prefix: "/receivables", name: t("common.nav.items.receivables"), anyOf: ["reports.view_receivables"] },
  { prefix: "/payables", name: t("common.nav.items.payables"), anyOf: ["reports.view_payables"] },
  { prefix: "/banking", name: t("common.nav.items.banking"), anyOf: ["banking.view"] },
  // US-RPT-22
  { prefix: "/journals", name: t("common.nav.items.journals"), anyOf: ["ledger.view"] },
  {
    prefix: "/reports",
    name: t("common.nav.items.reports"),
    // US-RPT-23: the Reports page lists whatever reports the person can open.
    anyOf: ["reports.view_dashboard_summary", "reports.view_receivables", "reports.view_payables", "reports.view_job_profitability", "reports.view_financial_statements", "ledger.view"],
  },
  // US-TEAM-30 (D-235): a section closed for every one of a Staff member's Teams. Expenses always opens (their own).
  ...SECTION_OPEN_CAPABILITIES.filter((s) => s.href !== "/expenses").map((s) => ({ prefix: s.href, name: s.section, anyOf: [s.capability] })),
];

/** Names for pages Field can't open, as the sidebar labels them. */
const PAGE_NAMES: Record<string, string> = {
  "/contacts": t("common.nav.items.contacts"),
  "/leads": t("common.nav.items.pipeline"),
  "/catalog": t("common.nav.items.catalogue"),
  "/quotes": t("common.nav.items.quotes"),
  "/invoices": t("common.nav.items.invoices"),
  "/credit-notes": t("common.nav.items.creditNotes"),
  "/payments": t("common.nav.items.payments"),
  "/receivables": t("common.nav.items.receivables"),
  "/vendor-bills": t("common.nav.items.vendorBills"),
  "/vendor-credits": t("common.nav.items.vendorCredits"),
  "/vendor-payments": t("common.nav.items.vendorPayments"),
  "/payables": t("common.nav.items.payables"),
  "/banking": t("common.nav.items.banking"),
  "/journals": t("common.nav.items.journals"),
  "/reports": t("common.nav.items.reports"),
  "/team": t("common.nav.sections.team"),
  "/emails": t("common.pageAccess.emailLog"),
  "/expenses/categories": t("common.pageAccess.expenseCategories"),
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
    return { state: "denied", pageName: prefix ? PAGE_NAMES[prefix]! : t("common.pageAccess.thisPage"), ownerOnly: rule?.ownerOnly ?? false, fixedRole: true };
  }

  if (!rule) return { state: "allowed" };
  if (rule.ownerOnly) return { state: "denied", pageName: rule.name, ownerOnly: true, fixedRole: false };
  if (!capabilities) return { state: "checking" };
  if (rule.anyOf?.some((c) => capabilities[c] === true)) return { state: "allowed" };
  return { state: "denied", pageName: rule.name, ownerOnly: false, fixedRole: false };
}
