import { AppShellHeader } from "@spine/ui";
import { VendorBillBuilder } from "../vendor-bill-builder";

export default function NewVendorBillPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Purchases" }, { label: "Vendor Bills", href: "/vendor-bills" }, { label: "New" }]}
        title="New vendor bill"
        description="Record what you owe a vendor. It saves as a draft until you record it."
      />
      <VendorBillBuilder />
    </>
  );
}
