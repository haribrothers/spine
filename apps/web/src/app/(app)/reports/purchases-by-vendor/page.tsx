import { ReportShell } from "../report-shell";
import { PurchaseReports } from "../expenses-by-category/purchase-reports";
import { t } from "../../../../lib/i18n";

/** US-RPT-29 — Purchases by vendor. */
export default function PurchasesByVendorPage() {
  return (
    <ReportShell slug="purchases-by-vendor" description={t("reports.pages.purchasesByVendor.description")}>
      <PurchaseReports tab="vendor" />
    </ReportShell>
  );
}
