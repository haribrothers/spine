import { ReportShell } from "../report-shell";
import { PaymentRegisters } from "./payment-registers";

/** US-RPT-30 — Payments received. */
export default function PaymentsReceivedPage() {
  return (
    <ReportShell slug="payments-received" description="Money received from customers and the invoices it settled">
      <PaymentRegisters tab="received" />
    </ReportShell>
  );
}
