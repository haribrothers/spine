import { AppShellHeader } from "@spine/ui";
import { VendorCreditsExplorer } from "./vendor-credits-explorer";

/** US-PUR-24, US-PUR-38 — Purchases › Vendor credits. */
export default function VendorCreditsPage() {
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Purchases" }, { label: "Vendor credits" }]} title="Vendor credits" description="Credit notes from vendors — for returns, overcharges and discounts after the bill — and what's left to use." />
      <VendorCreditsExplorer />
    </>
  );
}
