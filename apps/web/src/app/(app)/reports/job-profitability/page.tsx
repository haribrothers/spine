import { JobProfitabilityTab } from "../reports-explorer";
import { ReportShell } from "../report-shell";
import { t } from "../../../../lib/i18n";

/** S-09.4 — Job profitability (US-RPT-23: its own page). */
export default function JobProfitabilityPage() {
  return (
    <ReportShell slug="job-profitability" description={t("reports.pages.jobProfitability.description")}>
      <JobProfitabilityTab />
    </ReportShell>
  );
}
