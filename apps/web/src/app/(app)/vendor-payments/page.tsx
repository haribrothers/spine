import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { VendorPaymentsExplorer } from "./vendor-payments-explorer";

/** PRD FEAT-07 (S-07.8), US-PUR-51 (D-229) — the vendor payments list; each payment opens on its own page. */
export default function VendorPaymentsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Purchases" }, { label: "Vendor payments" }]}
        title="Vendor payments"
        description="Money paid to vendors — what it paid, from which account, and what's still to pay."
      />
      {/* US-DASH-13: the explorer reads ?contactId=&pay=1 from the URL. */}
      <Suspense>
        <VendorPaymentsExplorer />
      </Suspense>
    </>
  );
}
