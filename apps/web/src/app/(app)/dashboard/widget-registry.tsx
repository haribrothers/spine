import type { DashboardWidgetKey } from "@spine/shared";
import { DashboardSummary } from "./dashboard-summary";
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
 * S-09.13 — maps each `DashboardWidgetKey` (from the shared registry) to
 * the actual component that renders it, plus a human label for the
 * customize-mode reorder list. `kpi-summary` is the only entry backed by
 * the pre-existing `DashboardSummary` (S-09.10) rather than a widget
 * built for dashboard v2 — it's included in the same map since it's
 * reorderable/hideable exactly like every other widget from S-09.13's
 * perspective, even though it predates the registry.
 */
export const WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  "kpi-summary": "Cash, receivables, overdue, revenue",
  "revenue-trend": "Revenue trend",
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
  "kpi-summary": DashboardSummary,
  "revenue-trend": RevenueTrendChart,
  "pipeline-by-stage": PipelineByStageChart,
  "ar-aging": ArAgingDonut,
  "job-profitability": JobProfitabilityRanked,
  "overdue-followups": OverdueFollowups,
  "upcoming-meetings": UpcomingMeetings,
  "invoices-due": InvoicesDue,
  "milestones-due": MilestonesDue,
  "activity-feed": ActivityFeed,
};
