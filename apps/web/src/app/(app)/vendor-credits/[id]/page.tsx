import { AppShellHeader } from "@spine/ui";
import { VendorCreditDetail } from "../vendor-credit-detail";

export default async function VendorCreditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Purchases" }, { label: "Vendor Credits", href: "/vendor-credits" }, { label: "Detail" }]} title="Vendor credit" />
      <VendorCreditDetail creditId={id} />
    </>
  );
}
