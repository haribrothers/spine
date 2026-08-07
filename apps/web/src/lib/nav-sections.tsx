import { FileText, LayoutDashboard, Package, Users } from "lucide-react";
import type { AppShellNavSection } from "@spine/ui";

/**
 * The app's sidebar sections, shared across every routed page. Extracted
 * here rather than duplicated per-page now that Contacts is the second page
 * (after Dashboard) needing this array — Settings has no entry since it
 * opens as a dialog from the user menu, not a route. New top-level sections
 * (Quotes, ...) append here as their modules land.
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
      { href: "/catalog", label: "Catalogue", icon: <Package /> },
      { href: "/quotes", label: "Quotes", icon: <FileText /> },
    ],
  },
];
