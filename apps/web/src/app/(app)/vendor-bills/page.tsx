import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { VendorBillsExplorer } from "./vendor-bills-explorer";

/** PRD FEAT-07 (Phase 4 · Money Out & Books, Stage 2, S-07.1/S-07.5) — record what the org owes a vendor, tag it to a job, and post it to the ledger when it's ready. */
export default function VendorBillsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Purchases" }, { label: "Vendor Bills" }]}
        title="Vendor Bills"
        description="Record what you owe a vendor. Save as a draft, then record it to post to the ledger."
      />
      {/* US-PUR-22: the job filter reads the URL. */}
      <Suspense>
        <VendorBillsExplorer />
      </Suspense>
    </>
  );
}
