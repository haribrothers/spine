import { AppShellHeader } from "@spine/ui";
import { getSession } from "../../../lib/get-session";
import { DashboardSummary } from "./dashboard-summary";
import { SetupChecklist } from "./setup-checklist";
import { RevenueTrendChart } from "./widgets/revenue-trend-chart";
import { PipelineByStageChart } from "./widgets/pipeline-by-stage-chart";
import { ArAgingDonut } from "./widgets/ar-aging-donut";
import { JobProfitabilityRanked } from "./widgets/job-profitability-ranked";

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
 * shell Settings uses. S-09.10's stat-card row (`DashboardSummary`) is
 * real, backed by `GET /reports/dashboard-summary`.
 *
 * Dashboard v2 Stage 2 (S-09.11): the 4 new chart widgets below are
 * temporarily appended in a fixed grid — every widget self-gates by
 * rendering nothing on a 403/error, matching `DashboardSummary`'s own
 * convention, so a Staff/Field session simply sees fewer cards rather than
 * broken ones. Stage 3 replaces this fixed layout with a real
 * `DashboardShell` that composes a genuinely different, role-adaptive set
 * (not just "the same grid with gaps") — this interim state is real
 * shippable value for Owner in the meantime, not a placeholder to hide.
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RevenueTrendChart />
          <ArAgingDonut />
          <PipelineByStageChart />
          <JobProfitabilityRanked />
        </div>
        <SetupChecklist />
      </div>
    </>
  );
}
