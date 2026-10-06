import type { DashboardWidgetKey } from "@spine/shared";
import { MoneyInOutChart } from "./widgets/money-in-out-chart";
import { PipelineByStageChart } from "./widgets/pipeline-by-stage-chart";
import { ArAgingDonut } from "./widgets/ar-aging-donut";
import { JobProfitabilityRanked } from "./widgets/job-profitability-ranked";
import { InvoicesDue } from "./widgets/invoices-due";
import { ActivityFeed } from "./widgets/activity-feed";
import { MyJobs } from "./widgets/my-jobs";
import { RetentionHeldCard } from "./widgets/retention-held";
import { JobsInProgress } from "./widgets/jobs-in-progress";
import { MyExpenses } from "./widgets/my-expenses";
import { AccountsCard } from "./widgets/accounts-card";
import { PayablesCard } from "./widgets/payables-card";
import { TopExpensesCard } from "./widgets/top-expenses";
import { ReadyToBillCard } from "./widgets/ready-to-bill";

/** US-DASH-18 — Field's feed: events on their assigned jobs (the server filters it). */
function MyActivity() {
  return <ActivityFeed title="Recent activity on my jobs" />;
}

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
  accounts: "Accounts",
  payables: "Payables",
  "top-expenses": "Top expenses",
  "ready-to-bill": "Ready to bill",
  "money-in-out": "Money in and out",
  "pipeline-by-stage": "Pipeline by stage",
  "retention-held": "Retention held",
  "jobs-in-progress": "Jobs in progress",
  "ar-aging": "Receivables aging",
  "job-profitability": "Job profitability",
  "invoices-due": "Invoices due this week",
  "activity-feed": "Recent activity",
  "my-jobs": "My jobs",
  "my-expenses": "My expenses",
  "my-activity": "Recent activity on my jobs",
};

export const WIDGET_COMPONENTS: Record<DashboardWidgetKey, React.ComponentType> = {
  accounts: AccountsCard,
  payables: PayablesCard,
  "top-expenses": TopExpensesCard,
  "ready-to-bill": ReadyToBillCard,
  "money-in-out": MoneyInOutChart,
  "pipeline-by-stage": PipelineByStageChart,
  "retention-held": RetentionHeldCard,
  "jobs-in-progress": JobsInProgress,
  "ar-aging": ArAgingDonut,
  "job-profitability": JobProfitabilityRanked,
  "invoices-due": InvoicesDue,
  "activity-feed": ActivityFeed,
  "my-jobs": MyJobs,
  "my-expenses": MyExpenses,
  "my-activity": MyActivity,
};
