import { ReportShell } from "../report-shell";
import { GeneralLedger } from "./general-ledger";

/** US-RPT-24 — General ledger. */
export default function GeneralLedgerPage() {
  return (
    <ReportShell slug="general-ledger" description="Every account's opening balance, entries and closing balance">
      <GeneralLedger />
    </ReportShell>
  );
}
