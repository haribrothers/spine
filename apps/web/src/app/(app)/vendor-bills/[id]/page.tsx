import { AppShellHeader } from "@spine/ui";
import { VendorBillDetail } from "../vendor-bill-detail";

export default async function VendorBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Purchases" }, { label: "Vendor Bills", href: "/vendor-bills" }, { label: "Detail" }]} title="Vendor bill" />
      <VendorBillDetail billId={id} />
    </>
  );
}
