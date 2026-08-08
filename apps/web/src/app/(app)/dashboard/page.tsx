import { AppShellHeader } from "@spine/ui";
import { getSession } from "../../../lib/get-session";
import { SetupChecklist } from "./setup-checklist";

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
 * Renders inside the shared AppShell provided by `(app)/layout.tsx` — same
 * shell Settings uses. No stat-card row: the screenshot reference shows 4
 * KPI cards, but Spine has no real contacts/quotes/invoices data yet to
 * back them, and this dashboard deliberately doesn't fabricate placeholder
 * numbers — StatCard is ready in @spine/ui for whenever there's a real
 * metric to plug in.
 */
export default async function DashboardPage() {
  const session = await getSession();

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Overview" }, { label: "Dashboard" }]}
        title={session?.user?.name ? `Welcome, ${session.user.name}` : "Dashboard"}
        description="You're signed in to Spine."
      />
      <SetupChecklist />
    </>
  );
}
