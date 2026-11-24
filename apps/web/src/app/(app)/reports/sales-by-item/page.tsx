import { ReportShell } from "../report-shell";
import { SalesReports } from "../sales-by-customer/sales-reports";
import { t } from "../../../../lib/i18n";

/** US-RPT-28 — Sales by item. */
export default function SalesByItemPage() {
  return (
    <ReportShell slug="sales-by-item" description={t("reports.pages.salesByItem.description")}>
      <SalesReports tab="item" />
    </ReportShell>
  );
}
