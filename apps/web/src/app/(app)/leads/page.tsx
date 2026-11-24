import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { LeadsBoard } from "./leads-board";
import { t } from "../../../lib/i18n";

/**
 * S-01.5 — the pipeline board, rebuilt by US-CRM-24 to 28 (D-211): open
 * stages that fit, slim Won and Lost columns, a summary strip, a lead
 * drawer, and filters kept in the address. The board reads the address
 * with `useSearchParams`, hence the Suspense boundary.
 */
export default function LeadsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("leads.page.sales") }, { label: t("leads.page.title") }]}
        title={t("leads.page.title")}
        description={t("leads.page.description")}
      />
      <Suspense>
        <LeadsBoard />
      </Suspense>
    </>
  );
}
