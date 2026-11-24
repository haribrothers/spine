import { VendorCreditDetail } from "../vendor-credit-detail";

export default async function VendorCreditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    // US-PUR-37: the credit renders its own header, with its number as the page title.
    <VendorCreditDetail creditId={id} />
  );
}
