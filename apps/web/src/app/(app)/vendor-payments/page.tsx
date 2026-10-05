import { Suspense } from "react";
import { AppShellHeader } from "@spine/ui";
import { VendorPaymentsExplorer } from "./vendor-payments-explorer";

/** PRD FEAT-07 (S-07.8) — the standalone home for recording/viewing payments made to vendors, mirroring payments/page.tsx's own doc comment for the customer side. */
export default function VendorPaymentsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Purchases" }, { label: "Vendor Payments" }]}
        title="Vendor Payments"
        description="Record a payment to a vendor, fully allocated across their recorded bills."
      />
      {/* US-DASH-13: the explorer reads ?contactId=&pay=1 from the URL. */}
      <Suspense>
        <VendorPaymentsExplorer />
      </Suspense>
    </>
  );
}
