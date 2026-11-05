import { BalanceSheetTab } from "../reports-explorer";
import { ReportShell } from "../report-shell";
import { t } from "../../../../lib/i18n";

/** S-09.3 — Balance Sheet (US-RPT-23: its own page). */
export default function BalanceSheetPage() {
  return (
    <ReportShell slug="balance-sheet" description={t("reports.pages.balanceSheet.description")}>
      <BalanceSheetTab />
    </ReportShell>
  );
}
