import { ReportShell } from "../report-shell";
import { SalesReports } from "./sales-reports";

/** US-RPT-28 — Sales by customer. */
export default function SalesByCustomerPage() {
  return (
    <ReportShell slug="sales-by-customer">
      <SalesReports tab="customer" />
    </ReportShell>
  );
}
