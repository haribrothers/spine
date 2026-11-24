import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { t } from "../../../lib/i18n";
import { VendorPaymentsExplorer } from "./vendor-payments-explorer";

/** PRD FEAT-07 (S-07.8), US-PUR-51 (D-229) — the vendor payments list; each payment opens on its own page. */
export default function VendorPaymentsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("vendorPayments.page.breadcrumbPurchases") }, { label: t("vendorPayments.page.title") }]}
        title={t("vendorPayments.page.title")}
        description={t("vendorPayments.page.description")}
      />
      {/* US-DASH-13: the explorer reads ?contactId=&pay=1 from the URL. */}
      <Suspense>
        <VendorPaymentsExplorer />
      </Suspense>
    </>
  );
}
