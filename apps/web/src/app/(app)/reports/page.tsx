import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { ReportsCenter } from "./reports-center";
import { t } from "../../../lib/i18n";

/** US-RPT-23 — every report in one place. Each report is a page under /reports/<slug>. */
export default function ReportsPage() {
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: t("reports.pages.reports.title") }]} title={t("reports.pages.reports.title")} description={t("reports.pages.reports.description")} />
      {/* Reads ?tab= from old links to redirect them. */}
      <Suspense>
        <ReportsCenter />
      </Suspense>
    </>
  );
}
