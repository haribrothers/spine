import { ReportShell } from "../report-shell";
import { SalesReports } from "./sales-reports";
import { t } from "../../../../lib/i18n";

/** US-RPT-28 — Sales by customer. */
export default function SalesByCustomerPage() {
  return (
    <ReportShell slug="sales-by-customer" description={t("reports.pages.salesByCustomer.description")}>
      <SalesReports tab="customer" />
    </ReportShell>
  );
}
