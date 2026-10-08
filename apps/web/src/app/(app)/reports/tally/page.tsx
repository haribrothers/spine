import { ReportShell } from "../report-shell";
import { TallyExportView } from "./tally-export-view";

/** US-RPT-38 — the books as a file for TallyPrime or Tally.ERP 9. */
export default function TallyExportPage() {
  return (
    <ReportShell slug="tally" description="A file your accountant imports into TallyPrime or Tally.ERP 9.">
      <TallyExportView />
    </ReportShell>
  );
}
