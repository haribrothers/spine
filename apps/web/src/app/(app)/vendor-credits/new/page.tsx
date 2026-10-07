import { AppShellHeader } from "@spine/ui";
import { VendorCreditBuilder } from "../vendor-credit-builder";

export default function NewVendorCreditPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Purchases" }, { label: "Vendor Credits", href: "/vendor-credits" }, { label: "New" }]}
        title="New vendor credit"
        description="Record a vendor's credit note. It saves as a draft until you record it."
      />
      <VendorCreditBuilder />
    </>
  );
}
