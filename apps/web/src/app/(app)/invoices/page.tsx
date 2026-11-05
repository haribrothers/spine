import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { InvoicesExplorer } from "./invoices-explorer";
import { t } from "../../../lib/i18n";

/** PRD F5 Invoices (Stage 1 API, this stage's web UI) — multi-line invoices with issue/void, S-05.1/S-05.2/S-05.3/S-05.8/S-05.9. Advances/credit notes/quote conversion are later stages — see CHANGELOG. */
export default function InvoicesPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("invoices.page.breadcrumbBilling") }, { label: t("invoices.page.breadcrumbInvoices") }]}
        title={t("invoices.page.title")}
        description={t("invoices.page.description")}
      />
      {/* US-DASH-13: the explorer reads ?status= and ?select= from the URL. */}
      <Suspense>
        <InvoicesExplorer />
      </Suspense>
    </>
  );
}
