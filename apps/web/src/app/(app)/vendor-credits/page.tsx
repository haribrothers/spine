import { AppShellHeader } from "@spine/ui";
import { t } from "../../../lib/i18n";
import { VendorCreditsExplorer } from "./vendor-credits-explorer";

/** US-PUR-24, US-PUR-38 — Purchases › Vendor credits. */
export default function VendorCreditsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("vendorCredits.page.breadcrumbPurchases") }, { label: t("vendorCredits.page.title") }]}
        title={t("vendorCredits.page.title")}
        description={t("vendorCredits.page.description")}
      />
      <VendorCreditsExplorer />
    </>
  );
}
