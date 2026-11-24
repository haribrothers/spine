import { ReportShell } from "../report-shell";
import { PaymentRegisters } from "../payments-received/payment-registers";
import { t } from "../../../../lib/i18n";

/** US-RPT-30 — Payments made. */
export default function PaymentsMadePage() {
  return (
    <ReportShell slug="payments-made" description={t("reports.pages.paymentsMade.description")}>
      <PaymentRegisters tab="made" />
    </ReportShell>
  );
}
