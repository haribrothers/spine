import { AppShellHeader } from "@spine/ui";
import { t } from "../../../../lib/i18n";
import { VendorBillNewLoader } from "../vendor-bill-new-loader";

export default async function NewVendorBillPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("vendorBills.page.breadcrumbPurchases") }, { label: t("vendorBills.page.title"), href: "/vendor-bills" }, { label: t("vendorBills.newPage.breadcrumbNew") }]}
        title={t("vendorBills.newPage.title")}
        description={from ? t("vendorBills.newPage.descriptionCopy") : t("vendorBills.newPage.description")}
      />
      <VendorBillNewLoader from={from} />
    </>
  );
}
