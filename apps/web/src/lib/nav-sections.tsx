import { Banknote, BarChart3, BookOpen, CalendarDays, ClipboardList, FileMinus, FileText, HandCoins, HardHat, History, Inbox, Landmark, LayoutDashboard, Package, Receipt, ReceiptText, Shield, Target, Undo2, UserCog, Users, Wallet } from "lucide-react";
import type { AppShellNavSection } from "@spine/ui";
import { DEFAULT_MODULES, SECTION_OPEN_CAPABILITIES, moduleForPage, type Capability, type ModuleSettings } from "@spine/shared";
import { t } from "./i18n";

/**
 * The app's sidebar sections, shared across every routed page. Extracted
 * here rather than duplicated per-page now that Contacts is the second page
 * (after Dashboard) needing this array — Settings has no entry since it
 * opens as a dialog from the user menu, not a route. New top-level sections
 * (Quotes, ...) append here as their modules land.
 *
 * "Billing" is a deliberate second section, not folded into "Sales" —
 * mirrors the PRD's own phase naming (`docs/archive/spine-prd.md` §12: Phase 1 is
 * "Sales Spine", Phase 2 is "Money In", not part of Sales) and its
 * enquiry → quote → job → invoice → payment → books workflow, where a
 * quote is a sales document but an invoice is a financial one.
 *
 * "Jobs" (Phase 3) is its own top-level section for the same reason,
 * placed between Sales and Billing to match that workflow's own ordering
 * (quote → job → invoice) — not nested under Sales (a job outlives the
 * quote it came from and isn't itself a sales document) and not folded
 * into Billing (a job is a work container milestones/photos/variation
 * orders attach to, not a financial document). It's reachable for every
 * org regardless of industry template — S-04.1-S-04.10 aren't
 * construction-exclusive, only the retention-% field is tucked behind an
 * "Advanced" disclosure per-job (see job-detail.tsx's EditJobDialog).
 *
 * "Purchases" (Phase 4 Stage 2, FEAT-07) is the money-out mirror of
 * "Billing" — mirrors the PRD's own §7 grouping name exactly, kept as its
 * own top-level section rather than folded into Billing for the same
 * reason Billing itself isn't folded into Sales: Billing is what customers
 * owe the org, Purchases is what the org owes vendors/has spent — distinct
 * halves of the ledger a user reasons about separately day to day.
 * Ordered after Billing (money in, then money out, matching the PRD's own
 * enquiry → quote → job → invoice → payment → books → purchases/expenses
 * phase sequencing).
 */
export const NAV_SECTIONS: AppShellNavSection[] = [
  {
    label: t("common.nav.sections.overview"),
    items: [{ href: "/dashboard", label: t("common.nav.items.dashboard"), icon: <LayoutDashboard /> }],
  },
  {
    label: t("common.nav.sections.sales"),
    items: [
      { href: "/contacts", label: t("common.nav.items.contacts"), icon: <Users /> },
      { href: "/leads", label: t("common.nav.items.pipeline"), icon: <Target /> },
      { href: "/meetings", label: t("common.nav.items.meetings"), icon: <CalendarDays /> },
      { href: "/catalog", label: t("common.nav.items.catalogue"), icon: <Package /> },
      { href: "/quotes", label: t("common.nav.items.quotes"), icon: <FileText /> },
    ],
  },
  {
    label: t("common.nav.sections.jobs"),
    items: [{ href: "/jobs", label: t("common.nav.items.jobs"), icon: <HardHat /> }],
  },
  {
    label: t("common.nav.sections.billing"),
    items: [
      { href: "/invoices", label: t("common.nav.items.invoices"), icon: <Receipt /> },
      { href: "/credit-notes", label: t("common.nav.items.creditNotes"), icon: <Undo2 /> },
      { href: "/payments", label: t("common.nav.items.payments"), icon: <Banknote /> },
      { href: "/receivables", label: t("common.nav.items.receivables"), icon: <Inbox /> },
    ],
  },
  {
    label: t("common.nav.sections.purchases"),
    items: [
      { href: "/vendor-bills", label: t("common.nav.items.vendorBills"), icon: <ClipboardList /> },
      // US-PUR-24
      { href: "/vendor-credits", label: t("common.nav.items.vendorCredits"), icon: <FileMinus /> },
      { href: "/expenses", label: t("common.nav.items.expenses"), icon: <ReceiptText /> },
      { href: "/vendor-payments", label: t("common.nav.items.vendorPayments"), icon: <HandCoins /> },
      { href: "/payables", label: t("common.nav.items.payables"), icon: <Wallet /> },
    ],
  },
  {
    // US-BANK-01 (D-139): where the money actually sits.
    label: t("common.nav.sections.money"),
    items: [{ href: "/banking", label: t("common.nav.items.banking"), icon: <Landmark /> }],
  },
  {
    label: t("common.nav.sections.reports"),
    items: [
      { href: "/reports", label: t("common.nav.items.reports"), icon: <BarChart3 /> },
      // US-RPT-20–US-RPT-22 (D-134)
      { href: "/journals", label: t("common.nav.items.journals"), icon: <BookOpen /> },
    ],
  },
];

/**
 * Owner-only — Users/Teams/Permissions management. Kept separate from
 * NAV_SECTIONS (not just another entry in it) because it's the one section
 * that must be filtered out entirely for non-Owners: apps/(app)/layout.tsx
 * appends this only when getMyMembership() confirms role === "owner". Real
 * routes (not the Settings dialog) per PRD §9 S-10.18 — deep-linkable to a
 * specific user or team, with room for a privilege-matrix UI a dialog pane
 * can't comfortably hold. Every page under team/* independently re-checks
 * Owner status server-side too — hiding this link is not access control.
 */
export const TEAM_NAV_SECTION: AppShellNavSection = {
  label: t("common.nav.sections.team"),
  items: [
    { href: "/team/users", label: t("common.nav.items.users"), icon: <UserCog /> },
    { href: "/team/teams", label: t("common.nav.items.teams"), icon: <Shield /> },
    // US-SET-11 (D-064)
    { href: "/team/audit-log", label: t("common.nav.items.auditLog"), icon: <History /> },
  ],
};

/**
 * US-TEAM-18 — Field users get a short "Work" sidebar: the jobs they're
 * on, their meetings and their own expenses. Nothing that holds other
 * people's money.
 */
export const FIELD_NAV_SECTIONS: AppShellNavSection[] = [
  {
    label: t("common.nav.sections.overview"),
    items: [{ href: "/dashboard", label: t("common.nav.items.dashboard"), icon: <LayoutDashboard /> }],
  },
  {
    label: t("common.nav.sections.work"),
    items: [
      { href: "/jobs", label: t("common.nav.items.jobs"), icon: <HardHat /> },
      { href: "/meetings", label: t("common.nav.items.meetings"), icon: <CalendarDays /> },
      { href: "/expenses", label: t("common.nav.items.expenses"), icon: <ReceiptText /> },
    ],
  },
];

/** Items a Staff member sees only with the capability their page needs. */
const ITEM_CAPABILITY: Record<string, Capability> = {
  "/receivables": "reports.view_receivables",
  "/payables": "reports.view_payables",
  "/banking": "banking.view",
  "/journals": "ledger.view",
  // US-TEAM-30 (D-235): each section's Open permission. Expenses always opens (their own).
  ...Object.fromEntries(SECTION_OPEN_CAPABILITIES.filter((s) => s.href !== "/expenses").map((s) => [s.href, s.capability])),
};

/** The Reports page is shown to Staff who hold any report capability. */
const REPORT_CAPABILITIES: Capability[] = [
  "reports.view_dashboard_summary",
  "reports.view_receivables",
  "reports.view_payables",
  "reports.view_job_profitability",
  // US-RPT-23
  "reports.view_financial_statements",
  "ledger.view",
];

/**
 * US-TEAM-18 — the sidebar lists only what this person can open. Owners
 * see everything plus Team. Field get `FIELD_NAV_SECTIONS`. Staff see the
 * full sidebar minus Team and minus items whose capability they lack —
 * hidden until their capabilities have loaded, so nothing appears and then
 * vanishes. A convenience only: every page's API still refuses on its own.
 */
export function navSectionsFor(role: string | null, capabilities: Partial<Record<Capability, boolean>> | null, modules: ModuleSettings | null = DEFAULT_MODULES): AppShellNavSection[] {
  // US-SET-24: a switched-off module's items are gone (and hidden until the switches have loaded).
  const withoutOffModules = (sections: AppShellNavSection[]) =>
    sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          const key = moduleForPage(item.href);
          return !key || modules?.[key] === true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  return withoutOffModules(sectionsForRole(role, capabilities));
}

function sectionsForRole(role: string | null, capabilities: Partial<Record<Capability, boolean>> | null): AppShellNavSection[] {
  if (role === "owner") return [...NAV_SECTIONS, TEAM_NAV_SECTION];
  if (role === "field") return FIELD_NAV_SECTIONS;
  const has = (capability: Capability) => capabilities?.[capability] === true;
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.href === "/reports") return REPORT_CAPABILITIES.some(has);
      const needed = ITEM_CAPABILITY[item.href];
      return needed ? has(needed) : true;
    }),
  })).filter((section) => section.items.length > 0);
}

/**
 * Where a person stands in a section of Spine: they can work there (an
 * action is allowed, or the section is a report they may open), only view
 * it (its section is open and in their sidebar — but
 * nothing there is allowed), or can't open it at all.
 */
export type SectionAccess = "work" | "view" | "none";

/** The permissions that act in each section, by capability prefix. Report-like sections are work once they open. */
const SECTION_ACTIONS: Record<string, string[] | "opens"> = {
  "/contacts": ["contacts"],
  "/leads": ["leads", "activities"],
  "/meetings": ["meetings"],
  "/catalog": ["catalog"],
  "/quotes": ["quotes"],
  "/jobs": ["jobs", "milestones", "job_notes", "job_photos", "variation_orders"],
  "/invoices": ["invoices"],
  "/credit-notes": ["credit_notes"],
  "/payments": ["payments"],
  "/receivables": "opens",
  "/vendor-bills": ["vendor_bills"],
  "/vendor-credits": ["vendor_credits"],
  "/expenses": ["expenses", "expense_categories"],
  "/vendor-payments": ["vendor_payments"],
  "/payables": "opens",
  "/banking": ["banking.record", "banking.reconcile"],
  "/reports": "opens",
  "/journals": "opens",
};

/** Field always works in the sections their sidebar shows (US-TEAM-18). */
const FIELD_HREFS = new Set(FIELD_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href)));

/**
 * US-TEAM-20, US-TEAM-25, US-TEAM-28 — every section the business uses (not
 * Dashboard or the Owner-only Team section) with where this person stands
 * in it.
 */
export function sectionAccessFor(
  role: string | null,
  capabilities: Partial<Record<Capability, boolean>> | null,
  modules: ModuleSettings | null = DEFAULT_MODULES,
): { href: string; label: string; access: SectionAccess }[] {
  const all = navSectionsFor("owner", null, modules)
    .flatMap((s) => s.items)
    .filter((i) => i.href !== "/dashboard" && !i.href.startsWith("/team/"));
  const shown = new Set(navSectionsFor(role, capabilities, modules).flatMap((s) => s.items.map((i) => i.href)));
  // Opening a section (US-TEAM-30) isn't working in it.
  const opens = new Set<string>(SECTION_OPEN_CAPABILITIES.map((o) => o.capability));
  const granted = Object.entries(capabilities ?? {})
    .filter(([c, on]) => on && !opens.has(c))
    .map(([c]) => c);
  return all.map((item) => {
    let access: SectionAccess;
    if (role === "owner") access = "work";
    else if (role === "field") access = FIELD_HREFS.has(item.href) ? "work" : "none";
    else if (!shown.has(item.href)) access = "none";
    else {
      const rule = SECTION_ACTIONS[item.href];
      const works = rule === "opens" || (rule ?? []).some((p) => granted.some((c) => c === p || c.startsWith(`${p}.`)));
      access = works ? "work" : "view";
    }
    return { href: item.href, label: String(item.label), access };
  });
}
