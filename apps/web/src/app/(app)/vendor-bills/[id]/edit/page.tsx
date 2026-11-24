import { AppShellHeader } from "@spine/ui";
import { t } from "../../../../../lib/i18n";
import { VendorBillEditLoader } from "../../vendor-bill-edit-loader";

export default async function EditVendorBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("vendorBills.page.breadcrumbPurchases") }, { label: t("vendorBills.page.title"), href: "/vendor-bills" }, { label: t("vendorBills.editPage.breadcrumbEdit") }]}
        title={t("vendorBills.editPage.title")}
        description={t("vendorBills.editPage.description")}
      />
      <VendorBillEditLoader billId={id} />
    </>
  );
}
