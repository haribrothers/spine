import { LayoutDashboard } from "lucide-react";
import { AppShellHeader, type AppShellNavSection } from "@spine/ui";
import { AppLayout } from "../../components/app-layout";
import { getSession } from "../../lib/get-session";
import { SetupChecklist } from "./setup-checklist";

// Settings is no longer a route — it opens as a dialog from the sidebar's
// user menu (see AppUserMenu), so the "Organisation" nav group that used to
// link into it has no routes left to list. The persistent sidebar nav is
// just "Dashboard" under "Overview" until other real routed sections
// (contacts/quotes/invoices/jobs) exist to justify more nav items.
const SECTIONS: AppShellNavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard /> }],
  },
];

/**
 * Real landing page for the sign-up/login flow and for the onboarding
 * wizard's "finish"/"skip" actions. Middleware already redirects
 * unauthenticated requests to /login before this renders, but the session
 * is re-read here too so the page has real content to show rather than
 * trusting middleware alone. Deliberately does NOT redirect back into
 * /onboarding on every visit — onboarding is never a gate (CLAUDE.md), so a
 * returning user always lands here directly regardless of whether they
 * finished, skipped, or never started the wizard.
 *
 * Now renders inside the shared AppShell (apps/web/src/components/app-layout.tsx)
 * instead of a bare centered <main> — same shell Settings uses, with its
 * own nav sections (a single "Dashboard" item under "Overview", a link into
 * "Settings" under "Organisation") since contacts/quotes/invoices/jobs
 * modules don't exist yet to justify more nav items. No stat-card row: the
 * screenshot reference shows 4 KPI cards, but Spine has no real
 * contacts/quotes/invoices data yet to back them, and this dashboard
 * deliberately doesn't fabricate placeholder numbers — StatCard is ready in
 * @spine/ui for whenever there's a real metric (e.g. once quotes/invoices
 * land) to plug in.
 */
export default async function DashboardPage() {
  const session = await getSession();

  return (
    <AppLayout
      sections={SECTIONS}
      userName={session?.user?.name ?? "Signed in"}
      userEmail={session?.user?.email ?? ""}
    >
      <AppShellHeader
        breadcrumb={[{ label: "Overview" }, { label: "Dashboard" }]}
        title={session?.user?.name ? `Welcome, ${session.user.name}` : "Dashboard"}
        description="You're signed in to Spine."
      />
      <SetupChecklist />
    </AppLayout>
  );
}
