import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { QuotesExplorer } from "./quotes-explorer";
import { t } from "../../../lib/i18n";

/** PRD F3 Quotes (Stage 1) — multi-line quotes with versioning, S-03.1/S-03.2/S-03.8/S-03.9/S-03.11. PDF/email/public-link/notifications are Stage 2/3 — see CHANGELOG. */
export default function QuotesPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("quotes.breadcrumb.sales") }, { label: t("quotes.breadcrumb.quotes") }]}
        title={t("quotes.page.title")}
        description={t("quotes.page.description")}
      />
      {/* QuotesExplorer reads ?status= via useSearchParams, which needs a Suspense boundary. */}
      <Suspense>
        <QuotesExplorer />
      </Suspense>
    </>
  );
}
