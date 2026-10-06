import { ProfitAndLossTab } from "../reports-explorer";
import { ReportShell } from "../report-shell";

/** S-09.2 — Profit & Loss (US-RPT-23: its own page). */
export default function ProfitAndLossPage() {
  return (
    <ReportShell slug="profit-and-loss" description="Income less expenses for a period.">
      <ProfitAndLossTab />
    </ReportShell>
  );
}
