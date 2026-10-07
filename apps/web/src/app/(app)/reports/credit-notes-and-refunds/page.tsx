import { ReportShell } from "../report-shell";
import { CreditRegisters } from "./credit-registers";

/** US-RPT-31 — Credit notes and refunds. */
export default function CreditNotesAndRefundsPage() {
  return (
    <ReportShell slug="credit-notes-and-refunds" description="What was applied, refunded or is still held">
      <CreditRegisters tab="customer" />
    </ReportShell>
  );
}
