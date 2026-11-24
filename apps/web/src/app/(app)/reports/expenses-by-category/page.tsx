import { ReportShell } from "../report-shell";
import { PurchaseReports } from "./purchase-reports";
import { t } from "../../../../lib/i18n";

/** US-RPT-29 — Expenses by category. */
export default function ExpensesByCategoryPage() {
  return (
    <ReportShell slug="expenses-by-category" description={t("reports.pages.expensesByCategory.description")}>
      <PurchaseReports tab="category" />
    </ReportShell>
  );
}
