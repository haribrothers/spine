import { ReportShell } from "../report-shell";
import { SalesReports } from "../sales-by-customer/sales-reports";

/** US-RPT-28 — Sales by item. */
export default function SalesByItemPage() {
  return (
    <ReportShell slug="sales-by-item">
      <SalesReports tab="item" />
    </ReportShell>
  );
}
