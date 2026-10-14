import { AppShellHeader } from "@spine/ui";
import { VendorBillEditLoader } from "../../vendor-bill-edit-loader";

export default async function EditVendorBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Purchases" }, { label: "Vendor bills", href: "/vendor-bills" }, { label: "Edit" }]}
        title="Edit vendor bill"
        description="Only a draft can be edited — a recorded bill is immutable per CLAUDE.md."
      />
      <VendorBillEditLoader billId={id} />
    </>
  );
}
