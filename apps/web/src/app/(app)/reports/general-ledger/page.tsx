import { ReportShell } from "../report-shell";
import { GeneralLedger } from "./general-ledger";
import { t } from "../../../../lib/i18n";

/** US-RPT-24 — General ledger. */
export default function GeneralLedgerPage() {
  return (
    <ReportShell slug="general-ledger" description={t("reports.pages.generalLedger.description")}>
      <GeneralLedger />
    </ReportShell>
  );
}
