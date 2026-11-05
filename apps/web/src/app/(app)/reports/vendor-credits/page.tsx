import { ReportShell } from "../report-shell";
import { CreditRegisters } from "../credit-notes-and-refunds/credit-registers";
import { t } from "../../../../lib/i18n";

/** US-RPT-31 — Vendor credits. */
export default function VendorCreditsRegisterPage() {
  return (
    <ReportShell slug="vendor-credits-register" description={t("reports.pages.vendorCredits.description")}>
      <CreditRegisters tab="vendor" />
    </ReportShell>
  );
}
