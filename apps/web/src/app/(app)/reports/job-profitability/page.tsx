import { JobProfitabilityTab } from "../reports-explorer";
import { ReportShell } from "../report-shell";

/** S-09.4 — Job profitability (US-RPT-23: its own page). */
export default function JobProfitabilityPage() {
  return (
    <ReportShell slug="job-profitability" description="Billed, cost and margin for each job">
      <JobProfitabilityTab />
    </ReportShell>
  );
}
