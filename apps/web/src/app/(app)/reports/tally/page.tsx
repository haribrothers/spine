import { ReportShell } from "../report-shell";
import { TallyExportView } from "./tally-export-view";
import { t } from "../../../../lib/i18n";

/** US-RPT-38 — the books as a file for TallyPrime or Tally.ERP 9. */
export default function TallyExportPage() {
  return (
    <ReportShell slug="tally" description={t("reports.pages.tally.description")}>
      <TallyExportView />
    </ReportShell>
  );
}
