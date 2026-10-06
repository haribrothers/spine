import { ReportShell } from "../report-shell";
import { PurchaseReports } from "./purchase-reports";

/** US-RPT-29 — Expenses by category. */
export default function ExpensesByCategoryPage() {
  return (
    <ReportShell slug="expenses-by-category">
      <PurchaseReports tab="category" />
    </ReportShell>
  );
}
