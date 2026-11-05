import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { t } from "../../../lib/i18n";
import { VendorBillsExplorer } from "./vendor-bills-explorer";

/** PRD FEAT-07 (Phase 4 · Money Out & Books, Stage 2, S-07.1/S-07.5) — record what the org owes a vendor, tag it to a job, and post it to the ledger when it's ready. */
export default function VendorBillsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: t("vendorBills.page.breadcrumbPurchases") }, { label: t("vendorBills.page.title") }]}
        title={t("vendorBills.page.title")}
        description={t("vendorBills.page.description")}
      />
      {/* US-PUR-22, US-PUR-34: the filters, card, search, sort and page read the URL. */}
      <Suspense>
        <VendorBillsExplorer />
      </Suspense>
    </>
  );
}
