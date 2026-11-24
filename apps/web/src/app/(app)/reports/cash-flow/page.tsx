import { ReportShell } from "../report-shell";
import { CashFlow } from "./cash-flow";
import { t } from "../../../../lib/i18n";

/** US-RPT-26 — Cash Flow. */
export default function CashFlowPage() {
  return (
    <ReportShell slug="cash-flow" description={t("reports.pages.cashFlow.description")}>
      <CashFlow />
    </ReportShell>
  );
}
