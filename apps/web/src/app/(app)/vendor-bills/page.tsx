import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { VendorBillsExplorer } from "./vendor-bills-explorer";

/** PRD FEAT-07 (Phase 4 · Money Out & Books, Stage 2, S-07.1/S-07.5) — record what the org owes a vendor, tag it to a job, and post it to the ledger when it's ready. */
export default function VendorBillsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Purchases" }, { label: "Vendor bills" }]}
        title="Vendor bills"
        description="Bills from your vendors — what you owe, what's due, and what's paid."
      />
      {/* US-PUR-22, US-PUR-34: the filters, card, search, sort and page read the URL. */}
      <Suspense>
        <VendorBillsExplorer />
      </Suspense>
    </>
  );
}
