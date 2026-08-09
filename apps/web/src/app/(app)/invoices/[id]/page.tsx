import { AppShellHeader } from "@spine/ui";
import { InvoiceDetail } from "../invoice-detail";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Billing" }, { label: "Invoices", href: "/invoices" }, { label: "Detail" }]} title="Invoice" />
      <InvoiceDetail invoiceId={id} />
    </>
  );
}
