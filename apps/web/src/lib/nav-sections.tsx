import {
  Banknote,
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  HandCoins,
  HardHat,
  History,
  Landmark,
  Inbox,
  LayoutDashboard,
  Package,
  Receipt,
  ReceiptText,
  Shield,
  Target,
  Undo2,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { AppShellNavSection } from "@spine/ui";
import type { Capability } from "@spine/shared";

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
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard /> }],
  },
  {
    label: "Sales",
    items: [
      { href: "/contacts", label: "Contacts", icon: <Users /> },
      { href: "/leads", label: "Pipeline", icon: <Target /> },
      { href: "/meetings", label: "Meetings", icon: <CalendarDays /> },
      { href: "/catalog", label: "Catalogue", icon: <Package /> },
      { href: "/quotes", label: "Quotes", icon: <FileText /> },
    ],
  },
  {
    label: "Jobs",
    items: [{ href: "/jobs", label: "Jobs", icon: <HardHat /> }],
  },
  {
    label: "Billing",
    items: [
      { href: "/invoices", label: "Invoices", icon: <Receipt /> },
      { href: "/credit-notes", label: "Credit Notes", icon: <Undo2 /> },
      { href: "/payments", label: "Payments", icon: <Banknote /> },
      { href: "/receivables", label: "Receivables", icon: <Inbox /> },
    ],
  },
  {
    label: "Purchases",
    items: [
      { href: "/vendor-bills", label: "Vendor Bills", icon: <ClipboardList /> },
      { href: "/expenses", label: "Expenses", icon: <ReceiptText /> },
      { href: "/vendor-payments", label: "Vendor Payments", icon: <HandCoins /> },
      { href: "/payables", label: "Payables", icon: <Wallet /> },
    ],
  },
  {
    // US-BANK-01 (D-139): where the money actually sits.
    label: "Money",
    items: [{ href: "/banking", label: "Banking", icon: <Landmark /> }],
  },
  {
    label: "Reports",
    items: [{ href: "/reports", label: "Reports", icon: <BarChart3 /> }],
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
  label: "Team",
  items: [
    { href: "/team/users", label: "Users", icon: <UserCog /> },
    { href: "/team/teams", label: "Teams", icon: <Shield /> },
    // US-SET-11 (D-064)
    { href: "/team/audit-log", label: "Audit log", icon: <History /> },
  ],
};

/**
 * US-TEAM-18 — Field users get a short "Work" sidebar: the jobs they're
 * on, their meetings and their own expenses. Nothing that holds other
 * people's money.
 */
export const FIELD_NAV_SECTIONS: AppShellNavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard /> }],
  },
  {
    label: "Work",
    items: [
      { href: "/jobs", label: "Jobs", icon: <HardHat /> },
      { href: "/meetings", label: "Meetings", icon: <CalendarDays /> },
      { href: "/expenses", label: "Expenses", icon: <ReceiptText /> },
    ],
  },
];

/** Items a Staff member sees only with the capability their page needs. */
const ITEM_CAPABILITY: Record<string, Capability> = {
  "/receivables": "reports.view_receivables",
  "/payables": "reports.view_payables",
  "/banking": "banking.view",
};

/** The Reports page is shown to Staff who hold any report capability. */
const REPORT_CAPABILITIES: Capability[] = [
  "reports.view_dashboard_summary",
  "reports.view_receivables",
  "reports.view_payables",
  "reports.view_job_profitability",
];

/**
 * US-TEAM-18 — the sidebar lists only what this person can open. Owners
 * see everything plus Team. Field get `FIELD_NAV_SECTIONS`. Staff see the
 * full sidebar minus Team and minus items whose capability they lack —
 * hidden until their capabilities have loaded, so nothing appears and then
 * vanishes. A convenience only: every page's API still refuses on its own.
 */
export function navSectionsFor(role: string | null, capabilities: Partial<Record<Capability, boolean>> | null): AppShellNavSection[] {
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
