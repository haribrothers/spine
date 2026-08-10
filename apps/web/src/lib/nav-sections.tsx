import {
  Banknote,
  CalendarDays,
  ClipboardList,
  FileText,
  HandCoins,
  HardHat,
  Inbox,
  LayoutDashboard,
  Package,
  Receipt,
  ReceiptText,
  Shield,
  Target,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { AppShellNavSection } from "@spine/ui";

/**
 * The app's sidebar sections, shared across every routed page. Extracted
 * here rather than duplicated per-page now that Contacts is the second page
 * (after Dashboard) needing this array — Settings has no entry since it
 * opens as a dialog from the user menu, not a route. New top-level sections
 * (Quotes, ...) append here as their modules land.
 *
 * "Billing" is a deliberate second section, not folded into "Sales" —
 * mirrors the PRD's own phase naming (`docs/spine-prd.md` §12: Phase 1 is
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
  ],
};
