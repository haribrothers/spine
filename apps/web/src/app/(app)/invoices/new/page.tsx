import { AppShellHeader } from "@spine/ui";
import { InvoiceBuilder } from "../invoice-builder";
import { t } from "../../../../lib/i18n";

export default function NewInvoicePage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("invoices.page.breadcrumbBilling") }, { label: t("invoices.page.breadcrumbInvoices"), href: "/invoices" }, { label: t("invoices.newPage.breadcrumbNew") }]}
        title={t("invoices.newPage.title")}
        description={t("invoices.newPage.description")}
      />
      <InvoiceBuilder />
    </>
  );
}
