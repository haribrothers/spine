import { PaymentDetail } from "../payment-detail";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    // US-PAY-19: the payment renders its own header, with its receipt number as the page title.
    <PaymentDetail paymentId={id} />
  );
}
