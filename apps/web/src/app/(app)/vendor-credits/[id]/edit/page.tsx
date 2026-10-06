import { AppShellHeader } from "@spine/ui";
import { VendorCreditEditLoader } from "../../vendor-credit-builder";

export default async function EditVendorCreditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <AppShellHeader breadcrumb={[{ label: "Purchases" }, { label: "Vendor Credits", href: "/vendor-credits" }, { label: "Edit" }]} title="Edit vendor credit" description="Only a draft can be edited." />
      <VendorCreditEditLoader creditId={id} />
    </>
  );
}
