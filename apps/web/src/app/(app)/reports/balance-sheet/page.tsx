import { BalanceSheetTab } from "../reports-explorer";
import { ReportShell } from "../report-shell";

/** S-09.3 — Balance Sheet (US-RPT-23: its own page). */
export default function BalanceSheetPage() {
  return (
    <ReportShell slug="balance-sheet" description="What the business owns and owes">
      <BalanceSheetTab />
    </ReportShell>
  );
}
