import { TaxSummaryTab } from "../reports-explorer";
import { ReportShell } from "../report-shell";

/** US-RPT-14 — Tax Summary (US-RPT-23: its own page). */
export default function TaxSummaryPage() {
  return (
    <ReportShell slug="tax-summary" description="Tax collected from customers vs. tax paid to vendors, for filing.">
      <TaxSummaryTab />
    </ReportShell>
  );
}
