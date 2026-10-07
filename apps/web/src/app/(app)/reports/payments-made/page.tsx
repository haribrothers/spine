import { ReportShell } from "../report-shell";
import { PaymentRegisters } from "../payments-received/payment-registers";

/** US-RPT-30 — Payments made. */
export default function PaymentsMadePage() {
  return (
    <ReportShell slug="payments-made" description="Money paid to vendors and the bills it settled">
      <PaymentRegisters tab="made" />
    </ReportShell>
  );
}
