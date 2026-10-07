import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { ReportsCenter } from "./reports-center";

/** US-RPT-23 — every report in one place. Each report is a page under /reports/<slug>. */
export default function ReportsPage() {
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Reports" }]} title="Reports" description="Every report you can open, derived from the ledger." />
      {/* Reads ?tab= from old links to redirect them. */}
      <Suspense>
        <ReportsCenter />
      </Suspense>
    </>
  );
}
