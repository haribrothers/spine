import { AppShellHeader } from "@spine/ui";
import { t } from "../../../../lib/i18n";
import { VendorCreditNewLoader } from "../vendor-credit-builder";

export default async function NewVendorCreditPage({ searchParams }: { searchParams: Promise<{ billId?: string }> }) {
  const { billId } = await searchParams;
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("vendorCredits.page.breadcrumbPurchases") }, { label: t("vendorCredits.page.title"), href: "/vendor-credits" }, { label: t("vendorCredits.newPage.breadcrumbNew") }]}
        title={t("vendorCredits.newPage.title")}
        description={billId ? t("vendorCredits.newPage.descriptionFromBill") : t("vendorCredits.newPage.description")}
      />
      <VendorCreditNewLoader billId={billId} />
    </>
  );
}
