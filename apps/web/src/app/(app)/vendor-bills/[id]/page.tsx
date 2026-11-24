import { VendorBillDetail } from "../vendor-bill-detail";

export default async function VendorBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    // US-PUR-32: the bill renders its own header, with its number as the page title.
    <VendorBillDetail billId={id} />
  );
}
