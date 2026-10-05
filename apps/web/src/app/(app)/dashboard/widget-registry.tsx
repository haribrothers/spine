import type { DashboardWidgetKey } from "@spine/shared";
import { MoneyInOutChart } from "./widgets/money-in-out-chart";
import { PipelineByStageChart } from "./widgets/pipeline-by-stage-chart";
import { ArAgingDonut } from "./widgets/ar-aging-donut";
import { JobProfitabilityRanked } from "./widgets/job-profitability-ranked";
import { OverdueFollowups } from "./widgets/overdue-followups";
import { UpcomingMeetings } from "./widgets/upcoming-meetings";
import { InvoicesDue } from "./widgets/invoices-due";
import { MilestonesDue } from "./widgets/milestones-due";
import { ActivityFeed } from "./widgets/activity-feed";

/**
 * S-09.13 — maps each `DashboardWidgetKey` (from the shared registry) to
 * the actual component that renders it, plus a human label for the
 * edit-layout overlay. The KPI summary row (`DashboardSummary`, S-09.10)
 * is deliberately NOT in this map — per explicit user direction it must
 * never be movable or hideable, so `DashboardShell` renders it directly
 * as a pinned header, outside the customizable widget set entirely. See
 * `DASHBOARD_WIDGETS`' own doc comment in packages/shared for why it's
 * kept out of the registry itself, not just filtered from these maps.
 */
export const WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  "money-in-out": "Money in and out",
  "pipeline-by-stage": "Pipeline by stage",
  "ar-aging": "Receivables aging",
  "job-profitability": "Job profitability",
  "overdue-followups": "My overdue follow-ups",
  "upcoming-meetings": "Upcoming meetings",
  "invoices-due": "Invoices due this week",
  "milestones-due": "Job milestones due",
  "activity-feed": "Recent activity",
};

export const WIDGET_COMPONENTS: Record<DashboardWidgetKey, React.ComponentType> = {
  "money-in-out": MoneyInOutChart,
  "pipeline-by-stage": PipelineByStageChart,
  "ar-aging": ArAgingDonut,
  "job-profitability": JobProfitabilityRanked,
  "overdue-followups": OverdueFollowups,
  "upcoming-meetings": UpcomingMeetings,
  "invoices-due": InvoicesDue,
  "milestones-due": MilestonesDue,
  "activity-feed": ActivityFeed,
};
