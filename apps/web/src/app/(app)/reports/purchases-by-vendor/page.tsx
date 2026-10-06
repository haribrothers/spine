import { ReportShell } from "../report-shell";
import { PurchaseReports } from "../expenses-by-category/purchase-reports";

/** US-RPT-29 — Purchases by vendor. */
export default function PurchasesByVendorPage() {
  return (
    <ReportShell slug="purchases-by-vendor">
      <PurchaseReports tab="vendor" />
    </ReportShell>
  );
}
