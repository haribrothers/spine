import { ReportShell } from "../report-shell";
import { PaymentRegisters } from "./payment-registers";

/** US-RPT-30 — Payments received. */
export default function PaymentsReceivedPage() {
  return (
    <ReportShell slug="payments-received">
      <PaymentRegisters tab="received" />
    </ReportShell>
  );
}
