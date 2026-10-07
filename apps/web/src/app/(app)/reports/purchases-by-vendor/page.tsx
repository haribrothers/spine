import { ReportShell } from "../report-shell";
import { PurchaseReports } from "../expenses-by-category/purchase-reports";

/** US-RPT-29 — Purchases by vendor. */
export default function PurchasesByVendorPage() {
  return (
    <ReportShell slug="purchases-by-vendor" description="Recorded bills, net of vendor credits">
      <PurchaseReports tab="vendor" />
    </ReportShell>
  );
}
