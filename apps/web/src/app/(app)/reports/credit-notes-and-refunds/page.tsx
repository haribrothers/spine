import { ReportShell } from "../report-shell";
import { CreditRegisters } from "./credit-registers";

/** US-RPT-31 — Credit notes and refunds. */
export default function CreditNotesAndRefundsPage() {
  return (
    <ReportShell slug="credit-notes-and-refunds">
      <CreditRegisters tab="customer" />
    </ReportShell>
  );
}
