import { AppShellHeader } from "@spine/ui";
import { InvoiceBuilder } from "../invoice-builder";

export default function NewInvoicePage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Sales" }, { label: "Invoices", href: "/invoices" }, { label: "New" }]}
        title="New invoice"
        description="Build a multi-line invoice. It saves as a draft until you issue it."
      />
      <InvoiceBuilder />
    </>
  );
}
