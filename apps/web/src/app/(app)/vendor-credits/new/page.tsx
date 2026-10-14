import { AppShellHeader } from "@spine/ui";
import { VendorCreditNewLoader } from "../vendor-credit-builder";

export default async function NewVendorCreditPage({ searchParams }: { searchParams: Promise<{ billId?: string }> }) {
  const { billId } = await searchParams;
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Purchases" }, { label: "Vendor credits", href: "/vendor-credits" }, { label: "New" }]}
        title="New vendor credit"
        description={billId ? "A credit against a bill — its lines are copied for you to edit down." : "Record a vendor's credit note. It saves as a draft until you record it."}
      />
      <VendorCreditNewLoader billId={billId} />
    </>
  );
}
