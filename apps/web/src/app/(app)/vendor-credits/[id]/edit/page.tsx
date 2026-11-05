import { AppShellHeader } from "@spine/ui";
import { t } from "../../../../../lib/i18n";
import { VendorCreditEditLoader } from "../../vendor-credit-builder";

export default async function EditVendorCreditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("vendorCredits.page.breadcrumbPurchases") }, { label: t("vendorCredits.page.title"), href: "/vendor-credits" }, { label: t("vendorCredits.editPage.breadcrumbEdit") }]}
        title={t("vendorCredits.editPage.title")}
        description={t("vendorCredits.editPage.description")}
      />
      <VendorCreditEditLoader creditId={id} />
    </>
  );
}
