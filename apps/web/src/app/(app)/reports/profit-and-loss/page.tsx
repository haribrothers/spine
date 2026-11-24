import { ProfitAndLossTab } from "../reports-explorer";
import { ReportShell } from "../report-shell";
import { t } from "../../../../lib/i18n";

/** S-09.2 — Profit & Loss (US-RPT-23: its own page). */
export default function ProfitAndLossPage() {
  return (
    <ReportShell slug="profit-and-loss" description={t("reports.pages.profitAndLoss.description")}>
      <ProfitAndLossTab />
    </ReportShell>
  );
}
