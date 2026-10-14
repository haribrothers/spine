import { VendorPaymentDetail } from "../vendor-payment-detail";

export default async function VendorPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // US-PUR-49: the payment renders its own header, with its number as the page title.
  return <VendorPaymentDetail paymentId={id} />;
}
