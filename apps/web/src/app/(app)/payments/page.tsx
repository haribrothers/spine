import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { PaymentsExplorer } from "./payments-explorer";
import { t } from "../../../lib/i18n";

/** US-PAY-21 (D-221) — every payment: what came in, the credit customers can still use, and what each payment paid. */
export default function PaymentsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("payments.page.breadcrumbBilling") }, { label: t("payments.page.breadcrumbPayments") }]}
        title={t("payments.page.title")}
        description={t("payments.page.description")}
      />
      {/* US-PAY-22: the explorer reads its state (and an old ?id= link) from the address. */}
      <Suspense>
        <PaymentsExplorer />
      </Suspense>
    </>
  );
}
