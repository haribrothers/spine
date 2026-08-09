import { Banknote, CalendarDays, FileText, LayoutDashboard, Package, Receipt, Shield, Target, UserCog, Users } from "lucide-react";
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
 * quote is a sales document but an invoice is a financial one. This is
 * also the natural home for Payments/AR-aging/receivables once those get
 * their own pages (currently payment recording lives inside the invoice
 * detail page — see CHANGELOG).
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
    label: "Billing",
    items: [
      { href: "/invoices", label: "Invoices", icon: <Receipt /> },
      { href: "/payments", label: "Payments", icon: <Banknote /> },
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
