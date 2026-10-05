import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { ReportsExplorer } from "./reports-explorer";

/** PRD FEAT-09 (S-09.2, S-09.3, S-09.4, S-09.6, S-09.7) — P&L, Balance Sheet, job profitability, drill-down, CSV export. */
export default function ReportsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Reports" }]}
        title="Reports"
        description="Profit & Loss, Balance Sheet, Trial Balance, Tax Summary and job profitability, derived from the ledger."
      />
      {/* US-DASH-14: reads its starting view from the URL. */}
      <Suspense>
        <ReportsExplorer />
      </Suspense>
    </>
  );
}
