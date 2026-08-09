import { AppShellHeader } from "@spine/ui";
import { InvoiceEditLoader } from "../../invoice-edit-loader";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Billing" }, { label: "Invoices", href: "/invoices" }, { label: "Edit" }]}
        title="Edit invoice"
        description="Only a draft can be edited — an issued invoice is immutable per CLAUDE.md."
      />
      <InvoiceEditLoader invoiceId={id} />
    </>
  );
}
