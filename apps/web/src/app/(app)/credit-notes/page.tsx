import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { CreditNotesExplorer } from "./credit-notes-explorer";
import { t } from "../../../lib/i18n";

/** US-INV-40 (D-219) — every credit note: what was credited, the credit customers still hold, and where each went. */
export default function CreditNotesPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("creditNotes.page.breadcrumbBilling") }, { label: t("creditNotes.page.breadcrumbCreditNotes") }]}
        title={t("creditNotes.page.title")}
        description={t("creditNotes.page.description")}
      />
      {/* US-INV-41: the explorer reads its state from the address. */}
      <Suspense>
        <CreditNotesExplorer />
      </Suspense>
    </>
  );
}
