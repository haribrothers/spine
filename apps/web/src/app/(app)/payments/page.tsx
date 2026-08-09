import { AppShellHeader } from "@spine/ui";
import { PaymentsExplorer } from "./payments-explorer";

/** PRD F6 Payments (S-06.1–S-06.5) — the standalone home for recording/viewing payments, alongside the invoice-triggered "Record payment" dialog on the invoice detail page. */
export default function PaymentsPage() {
  return (
    <>
      <AppShellHeader
        breadcrumb={[{ label: "Billing" }, { label: "Payments" }]}
        title="Payments"
        description="Record payments against invoices, or hold unallocated credit for a customer."
      />
      <PaymentsExplorer />
    </>
  );
}
