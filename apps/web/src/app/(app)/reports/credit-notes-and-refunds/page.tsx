import { ReportShell } from "../report-shell";
import { CreditRegisters } from "./credit-registers";
import { t } from "../../../../lib/i18n";

/** US-RPT-31 — Credit notes and refunds. */
export default function CreditNotesAndRefundsPage() {
  return (
    <ReportShell slug="credit-notes-and-refunds" description={t("reports.pages.creditNotesAndRefunds.description")}>
      <CreditRegisters tab="customer" />
    </ReportShell>
  );
}
