import { ReportShell } from "../report-shell";
import { CreditRegisters } from "../credit-notes-and-refunds/credit-registers";

/** US-RPT-31 — Vendor credits. */
export default function VendorCreditsRegisterPage() {
  return (
    <ReportShell slug="vendor-credits-register">
      <CreditRegisters tab="vendor" />
    </ReportShell>
  );
}
