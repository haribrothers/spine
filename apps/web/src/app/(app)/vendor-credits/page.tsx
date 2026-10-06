import { AppShellHeader } from "@spine/ui";
import { VendorCreditsExplorer } from "./vendor-credits-explorer";

/** US-PUR-24 — Purchases › Vendor Credits. */
export default function VendorCreditsPage() {
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Purchases" }, { label: "Vendor Credits" }]} title="Vendor Credits" description="Credit notes from vendors — for returns, overcharges and discounts after the bill." />
      <VendorCreditsExplorer />
    </>
  );
}
