import { AppShellHeader } from "@spine/ui";
import { VendorBillNewLoader } from "../vendor-bill-new-loader";

export default async function NewVendorBillPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Purchases" }, { label: "Vendor bills", href: "/vendor-bills" }, { label: "New" }]}
        title="New vendor bill"
        description={from ? "A copy of another bill — enter the vendor's number for this one." : "Record what you owe a vendor. It saves as a draft until you record it."}
      />
      <VendorBillNewLoader from={from} />
    </>
  );
}
