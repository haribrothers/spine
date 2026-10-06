import { TrialBalanceTab } from "../reports-explorer";
import { ReportShell } from "../report-shell";

/** US-RPT-13 — Trial Balance (US-RPT-23: its own page). */
export default function TrialBalancePage() {
  return (
    <ReportShell slug="trial-balance" description="Every account's debit or credit balance on a date.">
      <TrialBalanceTab />
    </ReportShell>
  );
}
