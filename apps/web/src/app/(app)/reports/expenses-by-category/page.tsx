import { ReportShell } from "../report-shell";
import { PurchaseReports } from "./purchase-reports";

/** US-RPT-29 — Expenses by category. */
export default function ExpensesByCategoryPage() {
  return (
    <ReportShell slug="expenses-by-category" description="From bills, expenses, journals and money out">
      <PurchaseReports tab="category" />
    </ReportShell>
  );
}
