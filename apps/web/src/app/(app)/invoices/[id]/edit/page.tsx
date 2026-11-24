import { AppShellHeader } from "@spine/ui";
import { InvoiceEditLoader } from "../../invoice-edit-loader";
import { t } from "../../../../../lib/i18n";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("invoices.page.breadcrumbBilling") }, { label: t("invoices.page.breadcrumbInvoices"), href: "/invoices" }, { label: t("invoices.editPage.breadcrumbEdit") }]}
        title={t("invoices.editPage.title")}
        description={t("invoices.editPage.description")}
      />
      <InvoiceEditLoader invoiceId={id} />
    </>
  );
}
