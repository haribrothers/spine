import { Suspense } from "react";
import { TaxSummaryTab } from "../reports-explorer";
import { ReportShell } from "../report-shell";
import { t } from "../../../../lib/i18n";

/** US-RPT-14 — Tax Summary (US-RPT-23: its own page). */
export default function TaxSummaryPage() {
  return (
    <ReportShell slug="tax-summary" description={t("reports.pages.taxSummary.description")}>
      {/* US-DASH-25: reads ?from=&to= from the URL. */}
      <Suspense>
        <TaxSummaryTab />
      </Suspense>
    </ReportShell>
  );
}
