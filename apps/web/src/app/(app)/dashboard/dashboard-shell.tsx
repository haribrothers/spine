import { DashboardSummary } from "./dashboard-summary";
import { SetupChecklist } from "./setup-checklist";
import { RevenueTrendChart } from "./widgets/revenue-trend-chart";
import { PipelineByStageChart } from "./widgets/pipeline-by-stage-chart";
import { ArAgingDonut } from "./widgets/ar-aging-donut";
import { JobProfitabilityRanked } from "./widgets/job-profitability-ranked";
import { OverdueFollowups } from "./widgets/overdue-followups";
import { UpcomingMeetings } from "./widgets/upcoming-meetings";
import { InvoicesDue } from "./widgets/invoices-due";
import { MilestonesDue } from "./widgets/milestones-due";
import { ActivityFeed } from "./widgets/activity-feed";

/**
 * S-09.12 (dashboard v2) — the real role-adaptive dashboard composition,
 * replacing Stage 2's temporary fixed grid. Two genuinely different
 * layouts, not one layout with cards conditionally hidden — per the PRD's
 * own acceptance highlight: "never a widget rendered in a locked/greyed-
 * out state for a role that can't see it." `role` is resolved server-side
 * by the caller (`page.tsx`, via `getMyMembership()` — the same
 * cookie-forwarding pattern the sidebar's own Owner-only Team section
 * already uses) and passed down as a prop, never trusted from the client.
 *
 * Every individual widget still independently self-gates by rendering
 * nothing on its own data endpoint's 403/error (`DashboardSummary`'s
 * established convention) — this component's role branch is a UX/layout
 * decision about which widgets to even attempt, not the security
 * boundary. A Staff user without `dashboard.view` granted, for instance,
 * still reaches the Owner/Staff branch below (their org role is "staff"),
 * but every widget inside it individually renders nothing once its own
 * capability check fails server-side.
 */
export function DashboardShell({ role }: { role: string | null }) {
  if (role === "field") {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OverdueFollowups />
          <UpcomingMeetings />
        </div>
        <MilestonesDue />
        <ActivityFeed />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <DashboardSummary />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueTrendChart />
        <ArAgingDonut />
        <PipelineByStageChart />
        <JobProfitabilityRanked />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OverdueFollowups />
        <UpcomingMeetings />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InvoicesDue />
        <MilestonesDue />
      </div>
      <ActivityFeed />
      <SetupChecklist />
    </div>
  );
}
