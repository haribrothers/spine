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
import { TaxPeriodCard } from "./widgets/tax-period";
import { t } from "../../../lib/i18n";

/** US-DASH-18 — Field's feed: events on their assigned jobs (the server filters it). */
function MyActivity() {
  return <ActivityFeed title={t("dashboard.widgets.myActivity")} />;
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
  accounts: t("dashboard.widgets.accounts"),
  payables: t("dashboard.widgets.payables"),
  "top-expenses": t("dashboard.widgets.topExpenses"),
  "ready-to-bill": t("dashboard.widgets.readyToBill"),
  "tax-period": t("dashboard.widgets.taxPeriod"),
  "money-in-out": t("dashboard.widgets.moneyInOut"),
  "pipeline-by-stage": t("dashboard.widgets.pipelineByStage"),
  "retention-held": t("dashboard.widgets.retentionHeld"),
  "jobs-in-progress": t("dashboard.widgets.jobsInProgress"),
  "ar-aging": t("dashboard.widgets.arAging"),
  "job-profitability": t("dashboard.widgets.jobProfitability"),
  "invoices-due": t("dashboard.widgets.invoicesDue"),
  "activity-feed": t("dashboard.widgets.activityFeed"),
  "my-jobs": t("dashboard.widgets.myJobs"),
  "my-expenses": t("dashboard.widgets.myExpenses"),
  "my-activity": t("dashboard.widgets.myActivity"),
};

export const WIDGET_COMPONENTS: Record<DashboardWidgetKey, React.ComponentType> = {
  accounts: AccountsCard,
  payables: PayablesCard,
  "top-expenses": TopExpensesCard,
  "ready-to-bill": ReadyToBillCard,
  "tax-period": TaxPeriodCard,
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
