import { ReportShell } from "../report-shell";
import { PaymentRegisters } from "./payment-registers";
import { t } from "../../../../lib/i18n";

/** US-RPT-30 — Payments received. */
export default function PaymentsReceivedPage() {
  return (
    <ReportShell slug="payments-received" description={t("reports.pages.paymentsReceived.description")}>
      <PaymentRegisters tab="received" />
    </ReportShell>
  );
}
