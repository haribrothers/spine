import { TrialBalanceTab } from "../reports-explorer";
import { ReportShell } from "../report-shell";
import { t } from "../../../../lib/i18n";

/** US-RPT-13 — Trial Balance (US-RPT-23: its own page). */
export default function TrialBalancePage() {
  return (
    <ReportShell slug="trial-balance" description={t("reports.pages.trialBalance.description")}>
      <TrialBalanceTab />
    </ReportShell>
  );
}
