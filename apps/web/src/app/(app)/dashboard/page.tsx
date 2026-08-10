import { AppShellHeader } from "@spine/ui";
import { getSession } from "../../../lib/get-session";
import { DashboardSummary } from "./dashboard-summary";
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
 * shell Settings uses. S-09.10's stat-card row (`DashboardSummary`) is now
 * real, backed by `GET /reports/dashboard-summary` — cash position,
 * receivables, overdue count, and month revenue derived straight from the
 * ledger, not fabricated placeholder numbers.
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
      <div className="flex flex-col gap-6">
        <DashboardSummary />
        <SetupChecklist />
      </div>
    </>
  );
}
