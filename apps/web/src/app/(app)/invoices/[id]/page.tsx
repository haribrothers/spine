import { InvoiceDetail } from "../invoice-detail";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    // US-INV-30: the invoice renders its own header, with its number as the page title.
    <InvoiceDetail invoiceId={id} />
  );
}
